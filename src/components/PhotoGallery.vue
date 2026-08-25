<script setup lang="ts">
import { mdiClose, mdiDelete, mdiImagePlus } from '@mdi/js'
import { onMounted, ref } from 'vue'
import { remult } from 'remult'
import { Photo } from '@/shared/models/Photo'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'

const props = defineProps<{
  logId?: number
  locationId?: number
}>()

const photoRepo = remult.repo(Photo)

const photos = ref<Photo[]>([])
const loading = ref(true)
const uploading = ref(false)
const lightboxPhoto = ref<Photo | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.82
// Camera JPEGs are the case worth the CPU cost - already-small files, and
// other formats (PNG, WebP, GIF) are left alone rather than risking
// flattened transparency or broken animation for little upload-size benefit.
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024

async function compressImage(file: File): Promise<File> {
  if (file.type !== 'image/jpeg' || file.size <= COMPRESS_ABOVE_BYTES)
    return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size)
      return file

    return new File([blob], file.name, { type: 'image/jpeg', lastModified: file.lastModified })
  }
  catch {
    // Unsupported browser or a corrupt/undecodable image - upload the original.
    return file
  }
}

async function loadPhotos() {
  loading.value = true
  photos.value = await photoRepo.find({
    where: props.logId ? { log: { $id: props.logId } } : { location: { $id: props.locationId! } },
    orderBy: { createdAt: 'desc' },
  })
  loading.value = false
}

onMounted(loadPhotos)

function triggerFileInput() {
  fileInput.value?.click()
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0)
    return

  uploading.value = true
  let failures = 0

  for (const rawFile of Array.from(files)) {
    const file = await compressImage(rawFile)
    const formData = new FormData()
    formData.append('file', file)
    if (props.logId)
      formData.append('logId', String(props.logId))
    if (props.locationId)
      formData.append('locationId', String(props.locationId))

    try {
      const resp = await fetch('/api/photos', { method: 'POST', body: formData })
      if (!resp.ok) {
        failures++
        continue
      }
      photos.value.unshift(await resp.json())
    }
    catch {
      failures++
    }
  }

  uploading.value = false
  input.value = ''

  if (failures > 0)
    showAlert(`${failures} photo${failures === 1 ? '' : 's'} failed to upload`)
}

async function deletePhoto(photo: Photo) {
  const confirmed = await askConfirm('Delete this photo?', { confirmText: 'Delete' })
  if (!confirmed)
    return

  const resp = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' })
  if (!resp.ok) {
    showAlert('Failed to delete photo')
    return
  }
  photos.value = photos.value.filter(p => p.id !== photo.id)
  if (lightboxPhoto.value?.id === photo.id)
    lightboxPhoto.value = null
}
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div class="d-flex align-center justify-space-between">
      <span class="text-subtitle-1">Photos</span>
      <v-btn size="small" color="primary" :prepend-icon="mdiImagePlus" :loading="uploading" @click="triggerFileInput">
        Add Photos
      </v-btn>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFilesSelected">
    </div>

    <v-skeleton-loader v-if="loading" type="image" />

    <div v-else-if="photos.length" class="photo-grid">
      <div v-for="photo in photos" :key="photo.id" class="photo-thumb" @click="lightboxPhoto = photo">
        <v-img :src="`/api/photos/${photo.id}/file`" aspect-ratio="1" cover class="photo-thumb-img" />
        <v-btn
          class="photo-thumb-delete" icon size="x-small" color="error" variant="flat"
          @click.stop="deletePhoto(photo)"
        >
          <v-icon :icon="mdiDelete" size="16" />
        </v-btn>
      </div>
    </div>

    <p v-else class="text-medium-emphasis">
      No photos yet.
    </p>

    <v-dialog :model-value="!!lightboxPhoto" max-width="900" @update:model-value="lightboxPhoto = null">
      <v-card v-if="lightboxPhoto">
        <v-img :src="`/api/photos/${lightboxPhoto.id}/file`" />
        <v-card-actions class="justify-end">
          <v-btn icon variant="text" @click="lightboxPhoto = null">
            <v-icon :icon="mdiClose" />
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.photo-thumb {
  position: relative;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
}

.photo-thumb-delete {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
