export const IMAGE_UPLOAD_MAX_BYTES = 1 * 1024 * 1024;
export const IMAGE_UPLOAD_MAX_LABEL = "1MB";

export function isImageUploadWithinLimit(file: File): boolean {
    return file.size <= IMAGE_UPLOAD_MAX_BYTES;
}

export function getImageUploadSizeMessage(fileName?: string): string {
    return fileName
        ? `${fileName} exceeds the ${IMAGE_UPLOAD_MAX_LABEL} limit`
        : `Image must be ${IMAGE_UPLOAD_MAX_LABEL} or smaller`;
}
