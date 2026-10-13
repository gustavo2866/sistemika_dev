"""Reglas compartidas para materializar licencias en partes diarios."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlmodel import Session, select

from app.crud.nomina_licencia_crud import nomina_licencia_crud
from app.models.nomina import Nomina
from app.models.nomina_licencia import NominaLicencia
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import EstadoParteDiario, ParteDiario, ParteDiarioDetalle
from app.models.tarja import EstadoTarja, Tarja, TarjaDetalle, TarjaNomina
from app.utils.quincenas import get_quincena_range


@dataclass(frozen=True, slots=True)
class LicenciaParteDiario:
    licencia_id: int
    nomina_id: int
    empleado: str
    fecha_desde: date
    fecha_hasta: date | None
    estado_id: int
    estado_codigo: str
    estado_nombre: str
    descripcion: str

    def detalle_payload(self) -> dict[str, object]:
        return {
            "idnomina": self.nomina_id,
            "idestado": self.estado_id,
            "nomina_licencia_id": self.licencia_id,
            "horas": 0,
            "ingreso": None,
            "egreso": None,
            "descripcion": self.descripcion,
        }


@dataclass(frozen=True, slots=True)
class ConflictoNovedadLicencia:
    parte_diario_id: int
    detalle_id: int
    fecha: date
    idestado: int | None
    descripcion: str | None

    def as_dict(self) -> dict[str, object]:
        return {
            "parte_diario_id": self.parte_diario_id,
            "detalle_id": self.detalle_id,
            "fecha": self.fecha.isoformat(),
            "idestado": self.idestado,
            "descripcion": self.descripcion,
        }


@dataclass(frozen=True, slots=True)
class ImpactoLicencia:
    accion: str
    parte_diario_id: int
    fecha: date
    novedad_anterior: str | None = None
    novedad_nueva: str | None = None
    descripcion_anterior: str | None = None
    descripcion_nueva: str | None = None

    def as_dict(self) -> dict[str, object]:
        return {
            "accion": self.accion,
            "parte_diario_id": self.parte_diario_id,
            "fecha": self.fecha.isoformat(),
            "novedad_anterior": self.novedad_anterior,
            "novedad_nueva": self.novedad_nueva,
            "descripcion_anterior": self.descripcion_anterior,
            "descripcion_nueva": self.descripcion_nueva,
        }


@dataclass(frozen=True, slots=True)
class ValidacionCoberturaLicencia:
    tarjas_cerradas: tuple[dict[str, object], ...] = ()
    novedades_conflictivas: tuple[ConflictoNovedadLicencia, ...] = ()
    impacto: tuple[ImpactoLicencia, ...] = ()

    @property
    def bloqueada(self) -> bool:
        return bool(self.tarjas_cerradas)

    @property
    def requiere_confirmacion(self) -> bool:
        return not self.bloqueada and bool(self.novedades_conflictivas)

    def as_dict(self) -> dict[str, object]:
        if self.bloqueada:
            estado = "bloqueada"
            mensaje = "La cobertura solicitada afecta una o mas tarjas cerradas"
        elif self.requiere_confirmacion:
            estado = "requiere_confirmacion"
            mensaje = "Existen novedades que seran reemplazadas por la licencia"
        else:
            estado = "habilitada"
            mensaje = "La cobertura esta habilitada"
        return {
            "estado": estado,
            "mensaje": mensaje,
            "tarjas_cerradas": list(self.tarjas_cerradas),
            "novedades_conflictivas": [
                item.as_dict() for item in self.novedades_conflictivas
            ],
            "impacto": [item.as_dict() for item in self.impacto],
        }


class NominaLicenciaService:
    def validar_cobertura(
        self,
        session: Session,
        *,
        nomina_id: int,
        fecha_desde: date,
        fecha_hasta: date | None,
        tipo_novedad: str | None = None,
        comentario: str | None = None,
        licencia_id: int | None = None,
        cobertura_anterior: tuple[date, date | None] | None = None,
        eliminar: bool = False,
        fecha_desde_modificada: bool = False,
        tipo_novedad_modificado: bool = False,
    ) -> ValidacionCoberturaLicencia:
        """Valida el periodo que cambia antes de guardar o eliminar una licencia."""
        cobertura_nueva = None if eliminar else (fecha_desde, fecha_hasta)
        tarjas_cerradas: list[dict[str, object]] = []
        registros = session.exec(
            select(Tarja, TarjaNomina)
            .join(TarjaNomina, TarjaNomina.tarja_id == Tarja.id)
            .where(TarjaNomina.nomina_id == nomina_id)
            .where(Tarja.estado == EstadoTarja.CERRADO)
            .where(Tarja.deleted_at.is_(None))
            .where(TarjaNomina.deleted_at.is_(None))
        ).all()
        for tarja, tarja_nomina in registros:
            desde = max(tarja.fechainicio, tarja_nomina.fecha_desde)
            hasta = min(tarja.fechafinal, tarja_nomina.fecha_hasta)
            if desde > hasta:
                continue
            afecta = self._rango_tiene_fecha_afectada(
                desde,
                hasta,
                cobertura_anterior,
                cobertura_nueva,
            )
            if (
                (fecha_desde_modificada or tipo_novedad_modificado)
                and cobertura_anterior is not None
                and self._rangos_superpuestos(
                    desde,
                    hasta,
                    cobertura_anterior[0],
                    cobertura_anterior[1],
                )
            ):
                afecta = True
            if afecta:
                tarjas_cerradas.append(
                    {
                        "tarja_id": int(tarja.id),
                        "fecha_desde": desde.isoformat(),
                        "fecha_hasta": hasta.isoformat(),
                    }
                )

        conflictos: list[ConflictoNovedadLicencia] = []
        if cobertura_nueva is not None:
            detalles = session.exec(
                select(ParteDiarioDetalle, ParteDiario)
                .join(ParteDiario, ParteDiario.id == ParteDiarioDetalle.parte_diario_id)
                .where(ParteDiarioDetalle.idnomina == nomina_id)
                .where(ParteDiarioDetalle.deleted_at.is_(None))
                .where(ParteDiario.deleted_at.is_(None))
                .where(ParteDiario.estado != EstadoParteDiario.CERRADO)
            ).all()
            for detalle, parte in detalles:
                if not self._fecha_en_periodo(parte.fecha, cobertura_nueva):
                    continue
                if cobertura_anterior is not None and self._fecha_en_periodo(
                    parte.fecha, cobertura_anterior
                ):
                    continue
                if licencia_id is not None and detalle.nomina_licencia_id == licencia_id:
                    continue
                conflictos.append(
                    ConflictoNovedadLicencia(
                        parte_diario_id=int(parte.id),
                        detalle_id=int(detalle.id),
                        fecha=parte.fecha,
                        idestado=detalle.idestado,
                        descripcion=detalle.descripcion,
                    )
                )
        impacto = self._calcular_impacto(
            session,
            nomina_id=nomina_id,
            cobertura_nueva=cobertura_nueva,
            licencia_id=licencia_id,
            tipo_novedad=tipo_novedad,
            comentario=comentario,
        )
        return ValidacionCoberturaLicencia(
            tarjas_cerradas=tuple(tarjas_cerradas),
            novedades_conflictivas=tuple(conflictos),
            impacto=tuple(impacto),
        )

    def _calcular_impacto(
        self,
        session: Session,
        *,
        nomina_id: int,
        cobertura_nueva: tuple[date, date | None] | None,
        licencia_id: int | None,
        tipo_novedad: str | None,
        comentario: str | None,
    ) -> list[ImpactoLicencia]:
        impacto: list[ImpactoLicencia] = []
        estados = session.exec(
            select(ParteDiarioEstado).where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        estados_por_id = {
            int(estado.id): f"{estado.abreviatura} - {estado.nombre}"
            for estado in estados
            if estado.id is not None
        }
        codigo_nuevo = str(tipo_novedad or "").strip().upper()
        estado_nuevo = next(
            (
                estado
                for estado in estados
                if str(estado.abreviatura or "").strip().upper() == codigo_nuevo
            ),
            None,
        )
        novedad_nueva = (
            f"{estado_nuevo.abreviatura} - {estado_nuevo.nombre}"
            if estado_nuevo is not None
            else codigo_nuevo or None
        )
        descripcion_nueva = (
            self._descripcion_licencia_valores(
                fecha_desde=cobertura_nueva[0],
                fecha_hasta=cobertura_nueva[1],
                estado=estado_nuevo,
                comentario=comentario,
            )
            if cobertura_nueva is not None and estado_nuevo is not None
            else None
        )
        vinculados_por_parte: dict[int, tuple[ParteDiarioDetalle, ParteDiario]] = {}
        if licencia_id is not None:
            for detalle, parte in session.exec(
                select(ParteDiarioDetalle, ParteDiario)
                .join(ParteDiario, ParteDiario.id == ParteDiarioDetalle.parte_diario_id)
                .where(ParteDiarioDetalle.nomina_licencia_id == licencia_id)
                .where(ParteDiarioDetalle.deleted_at.is_(None))
                .where(ParteDiario.deleted_at.is_(None))
                .where(ParteDiario.estado != EstadoParteDiario.CERRADO)
            ).all():
                vinculados_por_parte[int(parte.id)] = (detalle, parte)
                if cobertura_nueva is None or not self._fecha_en_periodo(
                    parte.fecha, cobertura_nueva
                ) or detalle.idnomina != nomina_id:
                    impacto.append(
                        ImpactoLicencia(
                            accion="eliminar",
                            parte_diario_id=int(parte.id),
                            fecha=parte.fecha,
                            novedad_anterior=estados_por_id.get(int(detalle.idestado))
                            if detalle.idestado is not None
                            else None,
                            descripcion_anterior=detalle.descripcion,
                        )
                    )

        if cobertura_nueva is None:
            return sorted(impacto, key=lambda item: (item.fecha, item.parte_diario_id))

        partes_stmt = (
            select(ParteDiario)
            .where(ParteDiario.fecha >= cobertura_nueva[0])
            .where(ParteDiario.estado != EstadoParteDiario.CERRADO)
            .where(ParteDiario.deleted_at.is_(None))
        )
        if cobertura_nueva[1] is not None:
            partes_stmt = partes_stmt.where(ParteDiario.fecha <= cobertura_nueva[1])
        for parte in session.exec(partes_stmt).all():
            if nomina_id not in self._nomina_ids_para_parte(
                session,
                idproyecto=parte.idproyecto,
                contacto_id=parte.contacto_id,
                fecha=parte.fecha,
            ):
                continue
            existente = vinculados_por_parte.get(int(parte.id), (None, parte))[0]
            if existente is None:
                existente = session.exec(
                    select(ParteDiarioDetalle)
                    .where(ParteDiarioDetalle.parte_diario_id == int(parte.id))
                    .where(ParteDiarioDetalle.idnomina == nomina_id)
                    .where(ParteDiarioDetalle.deleted_at.is_(None))
                ).first()
            if existente is None:
                accion = "agregar"
            elif existente.nomina_licencia_id != licencia_id or licencia_id is None:
                accion = "reemplazar"
            elif estado_nuevo is not None and existente.idestado != estado_nuevo.id:
                accion = "actualizar_tipo"
            elif descripcion_nueva is not None and existente.descripcion != descripcion_nueva:
                accion = "actualizar_periodo"
            elif self._detalle_requiere_actualizacion(
                existente,
                licencia_id=licencia_id,
                nomina_id=nomina_id,
                estado_id=int(estado_nuevo.id) if estado_nuevo is not None else None,
                descripcion=descripcion_nueva,
            ):
                accion = "actualizar"
            else:
                accion = "sin_cambios"
            impacto.append(
                ImpactoLicencia(
                    accion=accion,
                    parte_diario_id=int(parte.id),
                    fecha=parte.fecha,
                    novedad_anterior=(
                        estados_por_id.get(int(existente.idestado))
                        if existente is not None and existente.idestado is not None
                        else None
                    ),
                    novedad_nueva=novedad_nueva,
                    descripcion_anterior=(
                        existente.descripcion if existente is not None else None
                    ),
                    descripcion_nueva=descripcion_nueva,
                )
            )
        return sorted(impacto, key=lambda item: (item.fecha, item.parte_diario_id))

    def sincronizar_partes_diarios(
        self,
        session: Session,
        *,
        licencia: NominaLicencia,
        cobertura_anterior: tuple[date, date | None] | None,
        eliminar: bool = False,
        reemplazar_novedades: bool = False,
    ) -> None:
        """Sincroniza la licencia con partes existentes sin tocar partes cerrados."""
        licencia_id = int(licencia.id)
        cobertura_nueva = None if eliminar else (
            licencia.fecha_desde,
            licencia.fecha_hasta,
        )

        vinculados = session.exec(
            select(ParteDiarioDetalle, ParteDiario)
            .join(ParteDiario, ParteDiario.id == ParteDiarioDetalle.parte_diario_id)
            .where(ParteDiarioDetalle.nomina_licencia_id == licencia_id)
            .where(ParteDiarioDetalle.deleted_at.is_(None))
            .where(ParteDiario.deleted_at.is_(None))
        ).all()
        vinculados_por_parte: dict[int, ParteDiarioDetalle] = {}
        partes_afectados: dict[int, ParteDiario] = {}
        for detalle, parte in vinculados:
            if parte.estado == EstadoParteDiario.CERRADO:
                continue
            if cobertura_nueva is None or not self._fecha_en_periodo(
                parte.fecha, cobertura_nueva
            ) or detalle.idnomina != licencia.nomina_id:
                self._desvincular_tarja_detalles(session, detalle)
                session.delete(detalle)
                partes_afectados[int(parte.id)] = parte
                continue
            vinculados_por_parte[int(parte.id)] = detalle

        if cobertura_nueva is None:
            session.flush()
            self._sincronizar_tarjas_abiertas(session, partes_afectados.values())
            return

        estado = self._estado_licencia(session, licencia.tipo_novedad)
        descripcion = self._descripcion_licencia(licencia, estado)
        partes_stmt = (
            select(ParteDiario)
            .where(ParteDiario.fecha >= licencia.fecha_desde)
            .where(ParteDiario.estado != EstadoParteDiario.CERRADO)
            .where(ParteDiario.deleted_at.is_(None))
        )
        if licencia.fecha_hasta is not None:
            partes_stmt = partes_stmt.where(ParteDiario.fecha <= licencia.fecha_hasta)

        for parte in session.exec(partes_stmt).all():
            if licencia.nomina_id not in self._nomina_ids_para_parte(
                session,
                idproyecto=parte.idproyecto,
                contacto_id=parte.contacto_id,
                fecha=parte.fecha,
            ):
                continue
            existente = vinculados_por_parte.get(int(parte.id))
            if existente is None:
                existente = session.exec(
                    select(ParteDiarioDetalle)
                    .where(ParteDiarioDetalle.parte_diario_id == int(parte.id))
                    .where(ParteDiarioDetalle.idnomina == licencia.nomina_id)
                    .where(ParteDiarioDetalle.deleted_at.is_(None))
                ).first()
            if existente is not None and existente.nomina_licencia_id != licencia_id:
                if not reemplazar_novedades:
                    raise ValueError(
                        f"El empleado tiene una novedad cargada el {parte.fecha.strftime('%d/%m/%Y')}"
                    )
                # Se reutiliza la fila para conservar referencias desde tarja_detalles.
                # La tarja abierta se reconstruye al finalizar la sincronizacion.
            if existente is None:
                existente = ParteDiarioDetalle(
                    parte_diario_id=int(parte.id),
                    idnomina=licencia.nomina_id,
                    horas=Decimal("0"),
                )
            elif not self._detalle_requiere_actualizacion(
                existente,
                licencia_id=licencia_id,
                nomina_id=int(licencia.nomina_id),
                estado_id=int(estado.id),
                descripcion=descripcion,
            ):
                continue
            existente.idestado = int(estado.id)
            existente.nomina_licencia_id = licencia_id
            existente.horas = Decimal("0")
            existente.ingreso = None
            existente.egreso = None
            existente.descripcion = descripcion
            session.add(existente)
            partes_afectados[int(parte.id)] = parte

        session.flush()
        self._sincronizar_tarjas_abiertas(session, partes_afectados.values())

    @staticmethod
    def _detalle_requiere_actualizacion(
        detalle: ParteDiarioDetalle,
        *,
        licencia_id: int,
        nomina_id: int,
        estado_id: int | None,
        descripcion: str | None,
    ) -> bool:
        return bool(
            detalle.nomina_licencia_id != licencia_id
            or detalle.idnomina != nomina_id
            or detalle.idestado != estado_id
            or Decimal(detalle.horas or 0) != Decimal("0")
            or detalle.ingreso is not None
            or detalle.egreso is not None
            or detalle.descripcion != descripcion
        )

    @staticmethod
    def _desvincular_tarja_detalles(
        session: Session,
        detalle: ParteDiarioDetalle,
    ) -> None:
        if detalle.id is None:
            return
        for tarja_detalle in session.exec(
            select(TarjaDetalle).where(
                TarjaDetalle.parte_diario_detalle_id == int(detalle.id)
            )
        ).all():
            tarja_detalle.parte_diario_detalle_id = None
            session.add(tarja_detalle)
        session.flush()

    @staticmethod
    def _sincronizar_tarjas_abiertas(
        session: Session,
        partes: Any,
    ) -> None:
        # Import local para evitar el ciclo parte_diario_service ->
        # nomina_licencia_service -> parte_diario_tarja_service -> agente ->
        # parte_diario_service durante el arranque de la aplicacion.
        from app.services.parte_diario_tarja_service import parte_diario_tarja_service

        for parte in partes:
            tarja = parte_diario_tarja_service.get_tarja_para_parte(
                session,
                int(parte.id),
            )
            if tarja is None:
                continue
            if tarja.estado == EstadoTarja.CERRADO:
                raise ValueError("La licencia afecta una tarja cerrada")
            parte_diario_tarja_service.sincronizar_detalle_para_parte(
                session,
                parte,
                auto_commit=False,
            )

    @staticmethod
    def _fecha_en_periodo(
        fecha: date,
        periodo: tuple[date, date | None] | None,
    ) -> bool:
        return bool(
            periodo is not None
            and fecha >= periodo[0]
            and (periodo[1] is None or fecha <= periodo[1])
        )

    def _rango_tiene_fecha_afectada(
        self,
        desde: date,
        hasta: date,
        anterior: tuple[date, date | None] | None,
        nueva: tuple[date, date | None] | None,
    ) -> bool:
        fecha = desde
        while fecha <= hasta:
            if self._fecha_en_periodo(fecha, anterior) != self._fecha_en_periodo(
                fecha, nueva
            ):
                return True
            fecha += timedelta(days=1)
        return False

    @staticmethod
    def _rangos_superpuestos(
        desde_a: date,
        hasta_a: date | None,
        desde_b: date,
        hasta_b: date | None,
    ) -> bool:
        return (hasta_a is None or desde_b <= hasta_a) and (
            hasta_b is None or desde_a <= hasta_b
        )

    @staticmethod
    def _descripcion_licencia(
        licencia: NominaLicencia,
        estado: ParteDiarioEstado,
    ) -> str:
        return NominaLicenciaService._descripcion_licencia_valores(
            fecha_desde=licencia.fecha_desde,
            fecha_hasta=licencia.fecha_hasta,
            estado=estado,
            comentario=licencia.comentario,
        )

    @staticmethod
    def _descripcion_licencia_valores(
        *,
        fecha_desde: date,
        fecha_hasta: date | None,
        estado: ParteDiarioEstado,
        comentario: str | None,
    ) -> str:
        hasta = (
            fecha_hasta.strftime("%d/%m")
            if fecha_hasta is not None
            else "fecha sin definir"
        )
        descripcion = (
            f"Licencia: {estado.nombre} - "
            f"Periodo {fecha_desde.strftime('%d/%m')} a {hasta}"
        )
        comentario_normalizado = str(comentario or "").strip()
        if comentario_normalizado:
            descripcion = f"{descripcion} - {comentario_normalizado}"
        return descripcion[:500]

    @staticmethod
    def _estado_licencia(
        session: Session,
        codigo: str,
    ) -> ParteDiarioEstado:
        estado = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.abreviatura == str(codigo).strip().upper())
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.licencia.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).first()
        if estado is None:
            raise ValueError("El tipo de licencia no esta habilitado")
        return estado

    def materializar_faltantes_desde_detalles(
        self,
        session: Session,
        *,
        fecha: date,
        detalles: list[dict[str, Any]],
    ) -> None:
        """Crea y vincula licencias informadas como novedades de un parte nuevo."""
        candidatos: list[tuple[dict[str, Any], int, ParteDiarioEstado]] = []
        estado_ids = {
            estado_id
            for detalle in detalles
            if isinstance(detalle, dict)
            and self._optional_int(detalle.get("nomina_licencia_id")) is None
            and (estado_id := self._optional_int(detalle.get("idestado"))) is not None
        }
        if not estado_ids:
            return

        estados = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.id.in_(estado_ids))
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.licencia.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        estados_por_id = {int(item.id): item for item in estados if item.id is not None}
        for detalle in detalles:
            if not isinstance(detalle, dict):
                continue
            if self._optional_int(detalle.get("nomina_licencia_id")) is not None:
                continue
            nomina_id = self._optional_int(detalle.get("idnomina"))
            estado_id = self._optional_int(detalle.get("idestado"))
            estado = estados_por_id.get(estado_id or 0)
            if nomina_id is not None and estado is not None:
                candidatos.append((detalle, nomina_id, estado))
        if not candidatos:
            return

        candidatos_por_nomina: dict[
            int,
            list[tuple[dict[str, Any], ParteDiarioEstado]],
        ] = {}
        for detalle, nomina_id, estado in candidatos:
            candidatos_por_nomina.setdefault(nomina_id, []).append((detalle, estado))
        repetidos = [
            nomina_id
            for nomina_id, items in candidatos_por_nomina.items()
            if len(items) > 1
        ]
        if repetidos:
            raise ValueError("Solo se admite una novedad por empleado en el parte diario")

        nomina_ids = set(candidatos_por_nomina)
        vigentes = session.exec(
            select(NominaLicencia)
            .where(NominaLicencia.nomina_id.in_(nomina_ids))
            .where(NominaLicencia.fecha_desde <= fecha)
            .where(
                NominaLicencia.fecha_hasta.is_(None)
                | (NominaLicencia.fecha_hasta >= fecha)
            )
            .where(NominaLicencia.deleted_at.is_(None))
        ).all()
        vigentes_por_nomina: dict[int, list[NominaLicencia]] = {}
        for licencia in vigentes:
            vigentes_por_nomina.setdefault(int(licencia.nomina_id), []).append(licencia)

        for nomina_id, items in candidatos_por_nomina.items():
            detalle, estado = items[0]
            existentes = vigentes_por_nomina.get(nomina_id, [])
            if len(existentes) > 1:
                raise ValueError(
                    f"El empleado {nomina_id} tiene mas de una licencia vigente para {fecha.isoformat()}"
                )
            codigo = str(estado.abreviatura or "").strip().upper()
            if existentes:
                existente = existentes[0]
                if str(existente.tipo_novedad or "").strip().upper() != codigo:
                    raise ValueError(
                        "El empleado ya tiene una licencia vigente de otro tipo para la fecha del parte"
                    )
                detalle["nomina_licencia_id"] = int(existente.id)
                continue

            comentario = str(detalle.get("descripcion") or "").strip() or None
            licencia = nomina_licencia_crud.create(
                session,
                {
                    "nomina_id": nomina_id,
                    "tipo_novedad": codigo,
                    "fecha_desde": fecha,
                    "fecha_hasta": None,
                    "comentario": comentario,
                },
                auto_commit=False,
            )
            detalle["nomina_licencia_id"] = int(licencia.id)

    def listar_vigentes_para_parte(
        self,
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
        fecha: date,
    ) -> list[LicenciaParteDiario]:
        nomina_ids = self._nomina_ids_para_parte(
            session,
            idproyecto=idproyecto,
            contacto_id=contacto_id,
            fecha=fecha,
        )
        if not nomina_ids:
            return []

        licencias = session.exec(
            select(NominaLicencia)
            .where(NominaLicencia.nomina_id.in_(nomina_ids))
            .where(NominaLicencia.fecha_desde <= fecha)
            .where(
                NominaLicencia.fecha_hasta.is_(None)
                | (NominaLicencia.fecha_hasta >= fecha)
            )
            .where(NominaLicencia.deleted_at.is_(None))
            .order_by(
                NominaLicencia.nomina_id,
                NominaLicencia.fecha_desde,
                NominaLicencia.id,
            )
        ).all()
        if not licencias:
            return []

        estados = session.exec(
            select(ParteDiarioEstado)
            .where(
                ParteDiarioEstado.abreviatura.in_(
                    {str(item.tipo_novedad or "").strip().upper() for item in licencias}
                )
            )
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        estados_por_codigo = {
            str(item.abreviatura or "").strip().upper(): item for item in estados
        }
        empleados = {
            int(item.id): item
            for item in session.exec(
                select(Nomina).where(Nomina.id.in_(nomina_ids))
            ).all()
            if item.id is not None
        }

        result: list[LicenciaParteDiario] = []
        usados: set[int] = set()
        for licencia in licencias:
            nomina_id = int(licencia.nomina_id)
            if nomina_id in usados:
                empleado = empleados.get(nomina_id)
                nombre = (
                    self._nombre_empleado(empleado)
                    if empleado is not None
                    else str(nomina_id)
                )
                raise ValueError(
                    f"El empleado {nombre} tiene mas de una licencia vigente para {fecha.isoformat()}"
                )
            estado_codigo = str(licencia.tipo_novedad or "").strip().upper()
            estado = estados_por_codigo.get(estado_codigo)
            if estado is None or not estado.activo or not estado.licencia:
                raise ValueError(
                    f"La licencia {licencia.id} usa un tipo de novedad que no esta "
                    "activo o no esta marcado como licencia"
                )
            empleado = empleados.get(nomina_id)
            comentario = str(licencia.comentario or "").strip()
            fecha_hasta_texto = (
                licencia.fecha_hasta.strftime("%d/%m")
                if licencia.fecha_hasta is not None
                else "fecha sin definir"
            )
            periodo = (
                f"Periodo {licencia.fecha_desde.strftime('%d/%m')} "
                f"a {fecha_hasta_texto}"
            )
            descripcion = f"Licencia: {estado.nombre} - {periodo}"
            if comentario:
                descripcion = f"{descripcion} - {comentario}"
            usados.add(nomina_id)
            result.append(
                LicenciaParteDiario(
                    licencia_id=int(licencia.id),
                    nomina_id=nomina_id,
                    empleado=(
                        self._nombre_empleado(empleado)
                        if empleado is not None
                        else f"Empleado #{nomina_id}"
                    ),
                    fecha_desde=licencia.fecha_desde,
                    fecha_hasta=licencia.fecha_hasta,
                    estado_id=int(estado.id),
                    estado_codigo=estado_codigo,
                    estado_nombre=estado.nombre,
                    descripcion=descripcion[:500],
                )
            )
        return result

    def integrar_detalles_creacion(
        self,
        data: dict[str, Any],
        licencias: list[LicenciaParteDiario],
    ) -> None:
        detalles_raw = data.get("detalles")
        detalles = list(detalles_raw) if isinstance(detalles_raw, list) else []
        licencias_por_nomina = {item.nomina_id: item for item in licencias}
        licencias_por_id = {item.licencia_id: item for item in licencias}
        encontrados: set[int] = set()

        for index, detalle in enumerate(detalles):
            if not isinstance(detalle, dict):
                continue
            nomina_id = self._optional_int(detalle.get("idnomina"))
            licencia_id = self._optional_int(detalle.get("nomina_licencia_id"))
            vigente = licencias_por_nomina.get(nomina_id or 0)
            licencia_informada = licencias_por_id.get(licencia_id or 0)
            if licencia_id is not None and (
                licencia_informada is None
                or licencia_informada.nomina_id != nomina_id
            ):
                raise ValueError(
                    "La licencia informada no corresponde al empleado, nomina y fecha del parte diario"
                )
            if vigente is None:
                continue
            if licencia_id != vigente.licencia_id:
                raise ValueError(
                    f"{vigente.empleado} tiene una licencia vigente y no admite otra novedad en este parte"
                )
            normalizado = dict(detalle)
            normalizado.update(vigente.detalle_payload())
            normalizado.pop("id", None)
            detalles[index] = normalizado
            encontrados.add(vigente.licencia_id)

        for licencia in licencias:
            if licencia.licencia_id not in encontrados:
                detalles.append(licencia.detalle_payload())
        data["detalles"] = detalles

    @staticmethod
    def detalle_sin_cambios(
        original,
        incoming: dict,
    ) -> bool:
        def optional_int(value):
            try:
                return int(value) if value not in (None, "") else None
            except (TypeError, ValueError):
                return None

        def optional_text(value):
            text = str(value or "").strip()
            return text or None

        try:
            incoming_horas = Decimal(str(incoming.get("horas") or 0))
        except (InvalidOperation, TypeError, ValueError):
            return False
        return (
            optional_int(incoming.get("idnomina")) == original.idnomina
            and optional_int(incoming.get("idestado")) == original.idestado
            and optional_int(incoming.get("nomina_licencia_id"))
            == original.nomina_licencia_id
            and incoming_horas == Decimal(str(original.horas))
            and optional_text(incoming.get("ingreso")) == optional_text(original.ingreso)
            and optional_text(incoming.get("egreso")) == optional_text(original.egreso)
            and optional_text(incoming.get("descripcion"))
            == optional_text(original.descripcion)
        )

    def _nomina_ids_para_parte(
        self,
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
        fecha: date,
    ) -> set[int]:
        inicio, fin = get_quincena_range(fecha)
        tarja_stmt = (
            select(Tarja)
            .where(Tarja.idproyecto == idproyecto)
            .where(Tarja.fechainicio == inicio)
            .where(Tarja.fechafinal == fin)
            .where(Tarja.deleted_at.is_(None))
        )
        tarja_stmt = (
            tarja_stmt.where(Tarja.contacto_id == contacto_id)
            if contacto_id is not None
            else tarja_stmt.where(Tarja.contacto_id.is_(None))
        )
        tarja = session.exec(tarja_stmt).first()
        if tarja is not None and tarja.id is not None:
            tiene_nomina = session.exec(
                select(TarjaNomina.id)
                .where(TarjaNomina.tarja_id == int(tarja.id))
                .where(TarjaNomina.deleted_at.is_(None))
                .limit(1)
            ).first()
            if tiene_nomina is not None:
                return {
                    int(item)
                    for item in session.exec(
                        select(TarjaNomina.nomina_id)
                        .where(TarjaNomina.tarja_id == int(tarja.id))
                        .where(TarjaNomina.fecha_desde <= fecha)
                        .where(TarjaNomina.fecha_hasta >= fecha)
                        .where(TarjaNomina.deleted_at.is_(None))
                    ).all()
                    if item is not None
                }

        nomina_stmt = (
            select(Nomina.id)
            .where(Nomina.idproyecto == idproyecto)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .where(Nomina.fecha_ingreso.is_(None) | (Nomina.fecha_ingreso <= fecha))
            .where(Nomina.fecha_egreso.is_(None) | (Nomina.fecha_egreso >= fecha))
        )
        nomina_stmt = (
            nomina_stmt.where(Nomina.encargado_contacto_id == contacto_id)
            if contacto_id is not None
            else nomina_stmt.where(Nomina.encargado_contacto_id.is_(None))
        )
        return {int(item) for item in session.exec(nomina_stmt).all()}

    @staticmethod
    def _nombre_empleado(empleado: Nomina) -> str:
        return f"{empleado.apellido}, {empleado.nombre}".strip(", ")

    @staticmethod
    def _optional_int(value) -> int | None:
        try:
            return int(value) if value not in (None, "") else None
        except (TypeError, ValueError):
            return None


nomina_licencia_service = NominaLicenciaService()
