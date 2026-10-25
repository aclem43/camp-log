<script setup lang="ts">
import { mdiClose, mdiDelete, mdiImagePlus } from '@mdi/js'
import { onMounted, ref } from 'vue'
import { remult } from 'remult'
import { Photo } from '@/shared/models/Photo'
import LoadError from '@/components/LoadError.vue'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { offline } from '@/scripts/connectivity'
import { describeFailure, isNetworkError } from '@/scripts/outbox'

const props = defineProps<{
  logId?: number
  locationId?: number
}>()

const photoRepo = remult.repo(Photo)

const photos = ref<Photo[]>([])
const loading = ref(true)
const loadError = ref(false)
const uploading = ref(false)
const lightboxPhoto = ref<Photo | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.82
// Camera JPEGs are the case worth the CPU cost - already-small files, and
// other formats (PNG, WebP, GIF) are left alone rather than risking
// flattened transparency or broken animation for little upload-size benefit.
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024
// Gallery thumbnails, so the grid doesn't pull full-size photos over mobile data.
const THUMBNAIL_DIMENSION = 400

// Scales an image down to fit `maxDimension` and re-encodes it as JPEG.
// Transparent areas come out white. Null if the browser can't decode it.
async function resizeToJpeg(file: File, maxDimension: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  }
  catch {
    // Unsupported browser or a corrupt/undecodable image.
    return null
  }
}

async function compressImage(file: File): Promise<File> {
  if (file.type !== 'image/jpeg' || file.size <= COMPRESS_ABOVE_BYTES)
    return file

  const blob = await resizeToJpeg(file, MAX_DIMENSION)
  if (!blob || blob.size >= file.size)
    return file
  return new File([blob], file.name, { type: 'image/jpeg', lastModified: file.lastModified })
}

async function makeThumbnail(file: File): Promise<File | null> {
  const blob = await resizeToJpeg(file, THUMBNAIL_DIMENSION)
  return blob && new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
}

function photoLabel(photo: Photo) {
  return photo.caption || photo.originalName || 'Photo'
}

async function loadPhotos() {
  loading.value = true
  loadError.value = false
  try {
    photos.value = await photoRepo.find({
      where: props.logId ? { log: { $id: props.logId } } : { location: { $id: props.locationId! } },
      orderBy: { createdAt: 'desc' },
    })
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
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
  let lostConnection = false

  for (const rawFile of Array.from(files)) {
    const [file, thumbnail] = await Promise.all([compressImage(rawFile), makeThumbnail(rawFile)])
    const formData = new FormData()
    formData.append('file', file)
    if (thumbnail)
      formData.append('thumbnail', thumbnail)
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
    catch (err) {
      failures++
      lostConnection ||= isNetworkError(err)
    }
  }

  uploading.value = false
  input.value = ''

  if (lostConnection)
    showAlert(`${failures} photo${failures === 1 ? '' : 's'} didn’t upload: uploading needs a connection. Add ${failures === 1 ? 'it' : 'them'} again when you’re back online.`)
  else if (failures > 0)
    showAlert(`${failures} photo${failures === 1 ? '' : 's'} failed to upload`)
}

async function deletePhoto(photo: Photo) {
  const confirmed = await askConfirm('Delete this photo?', { confirmText: 'Delete' })
  if (!confirmed)
    return

  let resp: Response
  try {
    resp = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' })
  }
  catch (err) {
    showAlert(describeFailure('delete photo', err))
    return
  }
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
      <span class="text-body-large">Photos</span>
      <v-btn
        color="primary" :prepend-icon="mdiImagePlus" :loading="uploading" :disabled="offline"
        @click="triggerFileInput"
      >
        Add Photos
      </v-btn>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFilesSelected">
    </div>

    <p v-if="offline" class="text-body-small text-medium-emphasis">
      Adding photos needs a connection.
    </p>

    <v-skeleton-loader v-if="loading" type="image" />

    <LoadError v-else-if="loadError" what="photos" @retry="loadPhotos" />

    <div v-else-if="photos.length" class="photo-grid">
      <div v-for="photo in photos" :key="photo.id" class="photo-thumb">
        <button type="button" class="photo-thumb-open" :aria-label="`Open ${photoLabel(photo)}`" @click="lightboxPhoto = photo">
          <v-img :src="`/api/photos/${photo.id}/thumb`" alt="" aspect-ratio="1" cover />
        </button>
        <v-btn
          class="photo-thumb-delete" icon size="small" color="error" variant="flat"
          :aria-label="`Delete ${photoLabel(photo)}`" @click="deletePhoto(photo)"
        >
          <v-icon :icon="mdiDelete" size="20" />
        </v-btn>
      </div>
    </div>

    <p v-else class="text-medium-emphasis">
      No photos yet.
    </p>

    <v-dialog :model-value="!!lightboxPhoto" max-width="900" @update:model-value="lightboxPhoto = null">
      <v-card v-if="lightboxPhoto">
        <v-img :src="`/api/photos/${lightboxPhoto.id}/file`" :alt="photoLabel(lightboxPhoto)" />
        <v-card-actions class="justify-end">
          <v-btn icon variant="text" aria-label="Close" @click="lightboxPhoto = null">
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
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.photo-thumb {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.photo-thumb-open {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.photo-thumb-open:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: -3px;
}

/* 44px to tap, though it only looks 32px */
.photo-thumb-delete {
  position: absolute;
  top: 4px;
  right: 4px;
}

.photo-thumb-delete::after {
  content: '';
  position: absolute;
  inset: -6px;
}
</style>
