"""
GDPR/DSGVO Compliance Service.

Provides functionality for:
- Pseudoanonymization of User and Student data
- Data export for subject access requests (Auskunftsanfrage)
- Data retention management
"""

import io
import json
import logging
import zipfile
from datetime import datetime

from django.utils import timezone

logger = logging.getLogger("kassenbuch.gdpr")


class GDPRService:
    """Service class for GDPR/DSGVO compliance operations."""

    @staticmethod
    def anonymize_user(user) -> dict:
        """
        Pseudoanonymize a user's personal data.

        Args:
            user: User instance to anonymize

        Returns:
            dict with anonymization details
        """
        from system.models import AuditLog

        if user.is_anonymized:
            return {"status": "already_anonymized", "user_id": user.pk}

        original_name = user.get_full_name()
        original_email = user.email

        # Anonymize the user
        user.anonymize()

        # Create audit log entry
        AuditLog.objects.create(
            user=None,  # System action
            action=AuditLog.Action.UPDATE,
            model_name="User",
            object_id=str(user.pk),
            changes={
                "action": "gdpr_anonymize",
                "original_name": original_name,
                "original_email": original_email,
                "anonymized_at": timezone.now().isoformat(),
            },
        )

        logger.info(f"GDPR: User #{user.pk} anonymized (was: {original_name})")

        return {
            "status": "anonymized",
            "user_id": user.pk,
            "anonymized_at": user.anonymized_at.isoformat(),
        }

    @staticmethod
    def anonymize_student(student) -> dict:
        """
        Pseudoanonymize a student's personal data.

        Args:
            student: Student instance to anonymize

        Returns:
            dict with anonymization details
        """
        from system.models import AuditLog

        if student.is_anonymized:
            return {"status": "already_anonymized", "student_id": student.pk}

        original_name = student.full_name

        # Anonymize the student
        student.anonymize()

        # Create audit log entry
        AuditLog.objects.create(
            user=None,  # System action
            action=AuditLog.Action.UPDATE,
            model_name="Student",
            object_id=str(student.pk),
            changes={
                "action": "gdpr_anonymize",
                "original_name": original_name,
                "anonymized_at": timezone.now().isoformat(),
            },
        )

        logger.info(f"GDPR: Student #{student.pk} anonymized (was: {original_name})")

        return {
            "status": "anonymized",
            "student_id": student.pk,
            "anonymized_at": student.anonymized_at.isoformat(),
        }

    @staticmethod
    def export_user_data(user) -> io.BytesIO:
        """
        Export all data collected for a user as a ZIP file.

        Implements GDPR Art. 15 - Right of access (Auskunftsrecht).

        Args:
            user: User instance to export data for

        Returns:
            BytesIO containing the ZIP file
        """
        from finance.models import Receipt, Transaction
        from groups.models import GroupMember
        from system.models import AuditLog
        from timetracking.models import LeaveRequest, TimeEntry

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # 1. User profile data
            profile_data = {
                "id": user.pk,
                "benutzername": user.username,
                "vorname": user.first_name,
                "nachname": user.last_name,
                "email": user.email,
                "telefon": user.phone or "",
                "rolle": user.get_role_display(),
                "standort": str(user.location) if user.location else "",
                "ist_aktiv": user.is_active,
                "2fa_aktiviert": user.is_2fa_enabled,
                "nutzungsbedingungen_akzeptiert": user.has_accepted_terms,
                "nutzungsbedingungen_akzeptiert_am": (
                    user.terms_accepted_at.isoformat() if user.terms_accepted_at else None
                ),
                "erstellt_am": user.date_joined.isoformat() if user.date_joined else None,
                "letzte_anmeldung": (
                    user.last_login.isoformat() if user.last_login else None
                ),
                "letzte_passwortaenderung": (
                    user.last_password_change.isoformat()
                    if user.last_password_change
                    else None
                ),
                "export_datum": timezone.now().isoformat(),
            }
            zf.writestr(
                "01_profildaten.json",
                json.dumps(profile_data, indent=2, ensure_ascii=False),
            )

            # 2. Time entries
            time_entries = TimeEntry.objects.filter(user=user).select_related("group")
            time_data = []
            for entry in time_entries:
                time_data.append({
                    "id": entry.pk,
                    "datum": entry.date.isoformat() if entry.date else None,
                    "startzeit": entry.start_time.isoformat() if entry.start_time else None,
                    "endzeit": entry.end_time.isoformat() if entry.end_time else None,
                    "pause_minuten": entry.break_minutes,
                    "gruppe": entry.group.name if entry.group else "",
                    "notizen": entry.notes or "",
                    "erstellt_am": entry.created_at.isoformat() if entry.created_at else None,
                })
            zf.writestr(
                "02_zeiteintraege.json",
                json.dumps(time_data, indent=2, ensure_ascii=False),
            )

            # 3. Leave requests
            leave_requests = LeaveRequest.objects.filter(user=user).select_related(
                "leave_type", "approved_by"
            )
            leave_data = []
            for leave in leave_requests:
                leave_data.append({
                    "id": leave.pk,
                    "typ": leave.leave_type.name if leave.leave_type else "",
                    "startdatum": leave.start_date.isoformat() if leave.start_date else None,
                    "enddatum": leave.end_date.isoformat() if leave.end_date else None,
                    "tage_gesamt": leave.total_days,
                    "status": leave.get_status_display() if hasattr(leave, "get_status_display") else leave.status,
                    "grund": leave.reason or "",
                    "genehmigt_von": (
                        leave.approved_by.get_full_name() if leave.approved_by else ""
                    ),
                    "genehmigungsnotizen": leave.approval_notes or "",
                    "erstellt_am": leave.created_at.isoformat() if leave.created_at else None,
                })
            zf.writestr(
                "03_urlaubsantraege.json",
                json.dumps(leave_data, indent=2, ensure_ascii=False),
            )

            # 4. Transactions created by user
            transactions = Transaction.objects.filter(created_by=user).select_related(
                "group", "category", "approved_by"
            )
            transaction_data = []
            for tx in transactions:
                transaction_data.append({
                    "id": tx.pk,
                    "beschreibung": tx.description,
                    "betrag": str(tx.amount),
                    "typ": tx.get_transaction_type_display() if hasattr(tx, "get_transaction_type_display") else tx.transaction_type,
                    "datum": tx.transaction_date.isoformat() if tx.transaction_date else None,
                    "gruppe": tx.group.name if tx.group else "",
                    "kategorie": tx.category.name if tx.category else "",
                    "status": tx.get_status_display() if hasattr(tx, "get_status_display") else tx.status,
                    "genehmigt_von": (
                        tx.approved_by.get_full_name() if tx.approved_by else ""
                    ),
                    "erstellt_am": tx.created_at.isoformat() if tx.created_at else None,
                })
            zf.writestr(
                "04_transaktionen.json",
                json.dumps(transaction_data, indent=2, ensure_ascii=False),
            )

            # 5. Receipts uploaded by user
            receipts = Receipt.objects.filter(uploaded_by=user).select_related("transaction")
            receipt_data = []
            for receipt in receipts:
                receipt_data.append({
                    "id": receipt.pk,
                    "transaktion_id": receipt.transaction_id,
                    "dateiname": receipt.file.name if receipt.file else "",
                    "hochgeladen_am": receipt.created_at.isoformat() if receipt.created_at else None,
                })
            zf.writestr(
                "05_belege.json",
                json.dumps(receipt_data, indent=2, ensure_ascii=False),
            )

            # 6. Group memberships
            memberships = GroupMember.objects.filter(user=user).select_related("group")
            membership_data = []
            for m in memberships:
                membership_data.append({
                    "id": m.pk,
                    "gruppe": m.group.name if m.group else "",
                    "rolle": m.get_role_display() if hasattr(m, "get_role_display") else m.role,
                    "beigetreten_am": m.joined_at.isoformat() if hasattr(m, "joined_at") and m.joined_at else None,
                })
            zf.writestr(
                "06_gruppenmitgliedschaften.json",
                json.dumps(membership_data, indent=2, ensure_ascii=False),
            )

            # 7. Audit logs for this user
            audit_logs = AuditLog.objects.filter(user=user).order_by("-created_at")[:500]
            audit_data = []
            for log in audit_logs:
                audit_data.append({
                    "id": log.pk,
                    "aktion": log.get_action_display(),
                    "modell": log.model_name,
                    "objekt_id": log.object_id,
                    "aenderungen": log.changes,
                    "ip_adresse": log.ip_address or "",
                    "erstellt_am": log.created_at.isoformat() if log.created_at else None,
                })
            zf.writestr(
                "07_audit_protokoll.json",
                json.dumps(audit_data, indent=2, ensure_ascii=False),
            )

            # 8. Summary / README
            summary = (
                f"DSGVO-Datenexport für: {user.get_full_name()}\n"
                f"E-Mail: {user.email}\n"
                f"Export-Datum: {timezone.now().strftime('%d.%m.%Y %H:%M:%S')}\n"
                f"Benutzer-ID: {user.pk}\n\n"
                f"Enthaltene Dateien:\n"
                f"  01_profildaten.json - Persönliche Daten und Einstellungen\n"
                f"  02_zeiteintraege.json - {len(time_data)} Zeiteinträge\n"
                f"  03_urlaubsantraege.json - {len(leave_data)} Urlaubsanträge\n"
                f"  04_transaktionen.json - {len(transaction_data)} Transaktionen\n"
                f"  05_belege.json - {len(receipt_data)} Belege\n"
                f"  06_gruppenmitgliedschaften.json - {len(membership_data)} Mitgliedschaften\n"
                f"  07_audit_protokoll.json - {len(audit_data)} Audit-Einträge\n\n"
                f"Dieser Export wurde gemäß Art. 15 DSGVO (Auskunftsrecht) erstellt.\n"
            )
            zf.writestr("README.txt", summary)

        zip_buffer.seek(0)
        return zip_buffer

    @staticmethod
    def export_student_data(student) -> io.BytesIO:
        """
        Export all data collected for a student as a ZIP file.

        Implements GDPR Art. 15 - Right of access (Auskunftsrecht).

        Args:
            student: Student instance to export data for

        Returns:
            BytesIO containing the ZIP file
        """
        from system.models import AuditLog

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # 1. Student profile data
            profile_data = {
                "id": student.pk,
                "vorname": student.first_name,
                "nachname": student.last_name,
                "geburtsdatum": (
                    student.date_of_birth.isoformat()
                    if student.date_of_birth
                    else None
                ),
                "email": student.email or "",
                "telefon": student.phone or "",
                "strasse": student.street or "",
                "stadt": student.city or "",
                "plz": student.postal_code or "",
                "gruppe": student.group.name if student.group else "",
                "ist_aktiv": student.is_active,
                "erstellt_am": student.created_at.isoformat() if student.created_at else None,
                "aktualisiert_am": student.updated_at.isoformat() if student.updated_at else None,
                "export_datum": timezone.now().isoformat(),
            }
            zf.writestr(
                "01_profildaten.json",
                json.dumps(profile_data, indent=2, ensure_ascii=False),
            )

            # 2. Audit logs for this student
            audit_logs = AuditLog.objects.filter(
                model_name="Student",
                object_id=str(student.pk),
            ).order_by("-created_at")[:200]
            audit_data = []
            for log in audit_logs:
                audit_data.append({
                    "id": log.pk,
                    "aktion": log.get_action_display(),
                    "aenderungen": log.changes,
                    "erstellt_am": log.created_at.isoformat() if log.created_at else None,
                })
            zf.writestr(
                "02_audit_protokoll.json",
                json.dumps(audit_data, indent=2, ensure_ascii=False),
            )

            # 3. Summary / README
            summary = (
                f"DSGVO-Datenexport für Schüler:in: {student.full_name}\n"
                f"Gruppe: {student.group.name if student.group else '-'}\n"
                f"Export-Datum: {timezone.now().strftime('%d.%m.%Y %H:%M:%S')}\n"
                f"Schüler-ID: {student.pk}\n\n"
                f"Enthaltene Dateien:\n"
                f"  01_profildaten.json - Persönliche Daten\n"
                f"  02_audit_protokoll.json - {len(audit_data)} Audit-Einträge\n\n"
                f"Dieser Export wurde gemäß Art. 15 DSGVO (Auskunftsrecht) erstellt.\n"
            )
            zf.writestr("README.txt", summary)

        zip_buffer.seek(0)
        return zip_buffer

    @staticmethod
    def get_retention_stats() -> dict:
        """
        Get statistics about data retention and anonymization status.

        Returns:
            dict with retention statistics
        """
        from core.models import User
        from groups.models import Student
        from system.models import SystemSetting

        try:
            setting = SystemSetting.objects.get(key="data_retention_years")
            retention_years = int(setting.value)
        except (SystemSetting.DoesNotExist, ValueError):
            retention_years = 7

        return {
            "retention_years": retention_years,
            "active_users": User.objects.filter(is_active=True, anonymized_at__isnull=True).count(),
            "anonymized_users": User.objects.filter(anonymized_at__isnull=False).count(),
            "deactivated_users": User.objects.filter(is_active=False, anonymized_at__isnull=True).count(),
            "active_students": Student.objects.filter(is_active=True, anonymized_at__isnull=True).count(),
            "anonymized_students": Student.objects.filter(anonymized_at__isnull=False).count(),
            "deleted_students": Student.objects.filter(is_deleted=True, anonymized_at__isnull=True).count(),
        }
