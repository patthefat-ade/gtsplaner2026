"""
Wiederverwendbare Validatoren fuer Datei-Uploads.

Schuetzt gegen bösartige Dateien durch serverseitige Validierung
von MIME-Type, Dateigroesse und Dateiendung.
"""

import mimetypes

from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible


# Erlaubte MIME-Types und Dateiendungen pro Kategorie
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "image/gif": [".gif"],
    "image/svg+xml": [".svg"],
}

ALLOWED_DOCUMENT_TYPES = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
}

# Maximale Dateigroessen in Bytes
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_RECEIPT_SIZE = 10 * 1024 * 1024  # 10 MB


@deconstructible
class FileTypeValidator:
    """
    Validiert den MIME-Type und die Dateiendung einer hochgeladenen Datei.

    Verwendung:
        file = models.FileField(validators=[FileTypeValidator(allowed_types=ALLOWED_DOCUMENT_TYPES)])
    """

    def __init__(self, allowed_types: dict[str, list[str]]):
        self.allowed_types = allowed_types

    def __call__(self, file):
        # 1. Dateiendung pruefen
        file_name = getattr(file, "name", "")
        ext = ""
        if "." in file_name:
            ext = "." + file_name.rsplit(".", 1)[-1].lower()

        allowed_extensions = set()
        for extensions in self.allowed_types.values():
            allowed_extensions.update(extensions)

        if ext and ext not in allowed_extensions:
            raise ValidationError(
                f"Dateityp '{ext}' ist nicht erlaubt. "
                f"Erlaubte Typen: {', '.join(sorted(allowed_extensions))}"
            )

        # 2. MIME-Type pruefen (aus Content-Type Header)
        content_type = getattr(file, "content_type", None)
        if content_type and content_type not in self.allowed_types:
            # Fallback: MIME-Type aus Dateiendung ableiten
            guessed_type, _ = mimetypes.guess_type(file_name)
            if guessed_type not in self.allowed_types:
                raise ValidationError(
                    f"Dateityp '{content_type}' ist nicht erlaubt. "
                    f"Erlaubte Typen: {', '.join(sorted(self.allowed_types.keys()))}"
                )

    def __eq__(self, other):
        return isinstance(other, FileTypeValidator) and self.allowed_types == other.allowed_types


@deconstructible
class FileSizeValidator:
    """
    Validiert die Groesse einer hochgeladenen Datei.

    Verwendung:
        file = models.FileField(validators=[FileSizeValidator(max_size=10 * 1024 * 1024)])
    """

    def __init__(self, max_size: int):
        self.max_size = max_size

    def __call__(self, file):
        file_size = getattr(file, "size", 0)
        if file_size > self.max_size:
            max_mb = self.max_size / (1024 * 1024)
            file_mb = file_size / (1024 * 1024)
            raise ValidationError(
                f"Datei ist zu gross ({file_mb:.1f} MB). "
                f"Maximale Groesse: {max_mb:.0f} MB."
            )

    def __eq__(self, other):
        return isinstance(other, FileSizeValidator) and self.max_size == other.max_size


# Vordefinierte Validator-Kombinationen
validate_image_type = FileTypeValidator(ALLOWED_IMAGE_TYPES)
validate_image_size = FileSizeValidator(MAX_IMAGE_SIZE)

validate_document_type = FileTypeValidator(ALLOWED_DOCUMENT_TYPES)
validate_document_size = FileSizeValidator(MAX_DOCUMENT_SIZE)

validate_receipt_type = FileTypeValidator(ALLOWED_DOCUMENT_TYPES)
validate_receipt_size = FileSizeValidator(MAX_RECEIPT_SIZE)
