import uuid

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.core.database import DbSession
from app.core.pagination import Pagination
from app.core.reports import (
    EXPORT_PAGE,
    EXPORT_PERMISSION,
    EXPORT_RESPONSES,
    FORMAT_QUERY,
    FileFormat,
    Range,
    Report,
    Sheet,
    describe,
    download,
    exportable,
    log_query,
)
from app.core.schemas import MessageResponse
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.patients import service as patient_service
from app.modules.patients.schemas import (
    ContactIn,
    ContactOut,
    ContactUpdate,
    PatientCounts,
    PatientDeactivate,
    PatientGroup,
    PatientIn,
    PatientOrder,
    PatientOut,
    PatientPage,
    PatientReactivate,
    PatientUpdate,
    to_contact_out,
    to_patient_out,
    to_patient_summary,
)
from app.modules.schedules.models import CATEGORY_LABELS
from app.modules.schedules.schemas import ScheduleCategory
from app.modules.users.models import PATIENTS_DEACTIVATE, PATIENTS_READ, PATIENTS_WRITE

router = APIRouter(prefix="/api/v1/patients", tags=["Afiliados"])

staff = require_permission(PATIENTS_READ)
editors = require_permission(PATIENTS_WRITE)
admin_only = require_permission(PATIENTS_DEACTIVATE)
exporters = require_permission(PATIENTS_READ, EXPORT_PERMISSION)


def _out(patient, current: CurrentUser) -> PatientOut:
    return to_patient_out(patient, patient_service.can_view_clinical_record(current, patient))


GROUP_LABELS = {
    "all": "Todos",
    "active": "Activos",
    "consent_pending": "Consentimiento pendiente",
    "inactive": "Inactivos",
}


class PatientFilters:
    """Filtros del listado de afiliados: los mismos para la página, las pestañas y la
    descarga. El rango de fechas es por fecha de registro de la ficha."""

    def __init__(
        self,
        period: Range,
        search: str | None = Query(default=None, max_length=120),
        access_status: str | None = Query(default=None, alias="status", max_length=20),
        include_inactive: bool = Query(default=False, alias="includeInactive"),
        group: PatientGroup | None = Query(
            default=None,
            description="Pestaña del listado; si se indica, reemplaza a includeInactive",
        ),
        activity: ScheduleCategory | None = Query(
            default=None,
            description="Solo quienes vinieron a esa actividad en los últimos 6 meses",
        ),
        order: PatientOrder = Query(default="recent"),
    ):
        self.period = period
        self.search = search
        self.access_status = access_status
        self.include_inactive = include_inactive
        self.group = group
        self.activity = activity
        self.order = order

    def run(self, db, page):
        return patient_service.list_patients(
            db,
            self.search,
            self.access_status,
            self.include_inactive,
            page,
            group=self.group,
            activity=self.activity,
            order=self.order,
            period=self.period,
        )

    def described(self) -> dict[str, str]:
        return describe(
            self.period,
            {
                "Pestaña": GROUP_LABELS.get(self.group or ""),
                "Búsqueda": self.search,
                "Actividad": CATEGORY_LABELS.get(self.activity or ""),
                "Estado": self.access_status,
            },
        )


@router.get("", response_model=PatientPage, response_model_by_alias=True)
def list_patients(
    db: DbSession,
    page: Pagination,
    filters: PatientFilters = Depends(),
    current: CurrentUser = Depends(staff),
):
    result, activities = filters.run(db, page)
    log_query("Afiliados", filters.described(), result.total)
    return PatientPage.of(
        result, lambda patient: to_patient_summary(patient, activities.get(patient.id))
    )


@router.get("/summary", response_model=PatientCounts, response_model_by_alias=True)
def patient_counts(
    db: DbSession,
    period: Range,
    search: str | None = Query(default=None, max_length=120),
    activity: ScheduleCategory | None = Query(default=None),
    current: CurrentUser = Depends(staff),
):
    """Contadores de las pestañas (con la misma búsqueda, actividad y fechas del listado)."""
    return patient_service.patient_counts(db, search, activity, period)


@router.get("/export", response_class=Response, responses=EXPORT_RESPONSES)
def export_patients(
    db: DbSession,
    filters: PatientFilters = Depends(),
    file_format: FileFormat = FORMAT_QUERY,
    current: CurrentUser = Depends(exporters),
):
    """Todas las fichas que cumplen el filtro del listado (sin datos clínicos)."""
    result, activities = filters.run(db, EXPORT_PAGE)
    patients = exportable(result)
    sheet = Sheet(
        "Afiliados",
        [
            "Nombre",
            "Carnet",
            "Teléfono",
            "Zona",
            "Familiar principal",
            "Teléfono del familiar",
            "Consentimiento",
            "Uso de imagen",
            "Estado de acceso",
            "Actividades (6 meses)",
            "Ficha",
            "Registrada",
        ],
    )
    for patient in patients:
        summary = to_patient_summary(patient, activities.get(patient.id))
        contact = summary.primary_contact
        sheet.rows.append(
            [
                patient.name,
                patient.ci,
                patient.phone,
                patient.zone,
                contact.name if contact else "",
                contact.phone if contact else "",
                "Firmado" if patient.consent else "Pendiente",
                patient.image_consent,
                patient.access_status,
                ", ".join(tag.label for tag in summary.activities),
                "Activa" if patient.active else "Inactiva",
                patient.created_at,
            ]
        )
    report = Report("Afiliados", "afiliados", "PACIENTES", filters.described(), "WARNING")
    return download(db, current, report, [sheet], file_format)


@router.get("/{patient_id}", response_model=PatientOut, response_model_by_alias=True)
def get_patient(patient_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(staff)):
    patient, clinical_access = patient_service.view_patient(db, patient_id, current)
    return to_patient_out(patient, clinical_access)


@router.post(
    "",
    response_model=PatientOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_patient(payload: PatientIn, db: DbSession, current: CurrentUser = Depends(editors)):
    return _out(patient_service.create_patient(db, payload, current), current)


@router.patch("/{patient_id}", response_model=PatientOut, response_model_by_alias=True)
def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    db: DbSession,
    current: CurrentUser = Depends(editors),
):
    return _out(patient_service.update_patient(db, patient_id, payload, current), current)


@router.post("/{patient_id}/deactivate", response_model=PatientOut, response_model_by_alias=True)
def deactivate_patient(
    patient_id: uuid.UUID,
    payload: PatientDeactivate,
    db: DbSession,
    current: CurrentUser = Depends(admin_only),
):
    """Baja lógica con motivo: nada se elimina (reemplaza a DELETE /patients/{id})."""
    patient = patient_service.deactivate_patient(db, patient_id, payload.reason, current)
    return _out(patient, current)


@router.post("/{patient_id}/reactivate", response_model=PatientOut, response_model_by_alias=True)
def reactivate_patient(
    patient_id: uuid.UUID,
    payload: PatientReactivate,
    db: DbSession,
    current: CurrentUser = Depends(admin_only),
):
    """Vuelve a activar una ficha dada de baja, con el motivo (por ejemplo, volvió a venir)."""
    patient = patient_service.reactivate_patient(db, patient_id, payload.reason, current)
    return _out(patient, current)


# ---------------------------------------------------------------------------
# Familiares y personas cuidadoras
# ---------------------------------------------------------------------------
@router.get("/{patient_id}/contacts", response_model=list[ContactOut], response_model_by_alias=True)
def list_contacts(patient_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(staff)):
    patient = patient_service.get_patient(db, patient_id)
    return [to_contact_out(contact) for contact in patient.active_contacts]


@router.post(
    "/{patient_id}/contacts",
    response_model=ContactOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def add_contact(
    patient_id: uuid.UUID,
    payload: ContactIn,
    db: DbSession,
    current: CurrentUser = Depends(editors),
):
    """Agrega un familiar o cuidador (hasta 5 activos). Con isPrimary pasa a ser el principal."""
    return to_contact_out(patient_service.add_contact(db, patient_id, payload, current))


@router.patch(
    "/{patient_id}/contacts/{contact_id}",
    response_model=ContactOut,
    response_model_by_alias=True,
)
def update_contact(
    patient_id: uuid.UUID,
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    db: DbSession,
    current: CurrentUser = Depends(editors),
):
    contact = patient_service.update_contact(db, patient_id, contact_id, payload, current)
    return to_contact_out(contact)


@router.delete("/{patient_id}/contacts/{contact_id}", response_model=MessageResponse)
def remove_contact(
    patient_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: DbSession,
    current: CurrentUser = Depends(editors),
):
    """Quita un contacto (baja lógica). La ficha conserva siempre al menos uno activo."""
    patient_service.remove_contact(db, patient_id, contact_id, current)
    return MessageResponse(message="Contacto quitado de la ficha.")
