from __future__ import annotations

from datetime import date, timedelta


def get_quincena_range(fecha: date) -> tuple[date, date]:
    if fecha.day <= 10:
        previous_month = fecha.replace(day=1) - timedelta(days=1)
        return previous_month.replace(day=26), fecha.replace(day=10)
    if fecha.day <= 25:
        return fecha.replace(day=11), fecha.replace(day=25)
    next_month = fecha.replace(day=28) + timedelta(days=4)
    return fecha.replace(day=26), next_month.replace(day=10)
