Objetivo
Crear la entidad que represena los totales de la factura.
Los mismos estarán compuestos por lineas de total identificadas por:
- concepto: fk a la entidad adm_conceptos
- centro_costo: fk a la entidad centros_costo
- tipo : "impuesto", "subtotal"
- descripcion: text de 50 caracteres
- importe

desde ahora hablaremos de dos tipos de conceptos
- subtotales
- impuestos

tipos de totales
surgen de agrupar el detalle de la factura por concepto y por centro de costo
el cocepto se toma de tipos_articulo , asociado a cada articulo
el impuesto se debe cargar manualmente.

funcionamiento
po_facturas/form contará con una sección "Totales"
en esta sección se mostrará la lista de totales de la factura editada.
los totales del tipo "subttotal" se calcularan dinamicamente en función de los items de la factura, cada vez que se agrega un nuevo item, se modifica, esto impacta en los items del tipo subtotal del pie, que muestra los subtotales por concepto y centro de costos. Estos totales no son editables y se modifican en funcion de los cambios en el detalle de la factura.
los totales del tipo impuesto pueden ser agregados o editados directamente por parte del usuario.


