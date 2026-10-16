"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
} from "@/lib/cloudinary-validation";
import { t } from "@/lib/strings";
import { discardUploadedImage, getUploadSignature } from "@/server/images";

const s = t.admin.products.images;

export type ImageItem = { publicId: string; url: string };

type Upload = { key: string; name: string; progress: number; error?: string };

type UploadParams = {
  cloudName: string;
  apiKey: string;
  signature: string;
  timestamp: number;
  folder: string;
  allowed_formats: string;
};

/** Direct browser -> Cloudinary upload with progress (fetch cannot report upload progress). */
function uploadToCloudinary(
  file: File,
  p: UploadParams,
  onProgress: (percent: number) => void,
): Promise<ImageItem> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", p.apiKey);
    body.append("timestamp", String(p.timestamp));
    body.append("signature", p.signature);
    body.append("folder", p.folder);
    body.append("allowed_formats", p.allowed_formats);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${p.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error(s.uploadFailed));
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.public_id && res.secure_url) {
          resolve({ publicId: res.public_id, url: res.secure_url });
          return;
        }
      } catch {
        // fall through
      }
      reject(new Error(s.uploadFailed));
    };
    xhr.send(body);
  });
}

function SortableTile({
  item,
  index,
  onRemove,
}: {
  item: ImageItem;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.publicId,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-muted relative aspect-square overflow-hidden rounded-lg border ${
        isDragging ? "z-10 opacity-80 shadow-lg" : ""
      }`}
    >
      <Image
        src={item.url}
        alt=""
        fill
        sizes="160px"
        className="pointer-events-none object-cover"
        draggable={false}
      />
      {index === 0 && (
        <span className="bg-primary text-primary-foreground absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium">
          {s.cover}
        </span>
      )}
      <button
        type="button"
        aria-label={s.drag}
        className="absolute bottom-1.5 left-1.5 flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-black/60 text-white active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        aria-label={s.remove}
        title={s.remove}
        onClick={onRemove}
        className="absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-red-600"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

export function ImageManager({
  images,
  onChange,
  onBusyChange,
  error,
}: {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  onBusyChange: (busy: boolean) => void;
  error?: string;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Always the latest list, so several uploads finishing at once don't overwrite each other.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  function commit(next: ImageItem[]) {
    imagesRef.current = next;
    onChange(next);
  }
  // Files uploaded in this session but not yet saved: deleting them also deletes the file.
  const unsaved = useRef(new Set<string>());
  const active = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patchUpload(key: string, patch: Partial<Upload>) {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }

  function setBusy(delta: number) {
    active.current += delta;
    onBusyChange(active.current > 0);
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    if (inputRef.current) inputRef.current.value = "";

    const room = MAX_PRODUCT_IMAGES - imagesRef.current.length - active.current;
    if (picked.length > room) toast.error(s.tooMany);

    const accepted: File[] = [];
    for (const file of picked.slice(0, Math.max(room, 0))) {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
        toast.error(`${file.name} : ${s.badType}`);
      } else if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} : ${s.tooBig}`);
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length === 0) return;

    setBusy(accepted.length);
    const signed = await getUploadSignature();
    if (!signed.ok) {
      toast.error(signed.error || s.signatureFailed);
      setBusy(-accepted.length);
      return;
    }
    const params: UploadParams = signed.upload;

    await Promise.all(
      accepted.map(async (file) => {
        const key = `${file.name}-${crypto.randomUUID()}`;
        setUploads((list) => [...list, { key, name: file.name, progress: 0 }]);
        try {
          const uploaded = await uploadToCloudinary(file, params, (progress) =>
            patchUpload(key, { progress }),
          );
          unsaved.current.add(uploaded.publicId);
          commit([...imagesRef.current, uploaded]);
          setUploads((list) => list.filter((u) => u.key !== key));
        } catch (e) {
          const message = e instanceof Error ? e.message : s.uploadFailed;
          patchUpload(key, { error: message });
          toast.error(`${file.name} : ${message}`);
        } finally {
          setBusy(-1);
        }
      }),
    );
  }

  function remove(item: ImageItem) {
    commit(imagesRef.current.filter((i) => i.publicId !== item.publicId));
    if (unsaved.current.delete(item.publicId)) {
      // Never saved: delete the file now. Saved images are deleted when the form is saved.
      void discardUploadedImage(item.publicId);
    }
  }

  function onDragEnd({ active: dragged, over }: DragEndEvent) {
    if (!over || dragged.id === over.id) return;
    const list = imagesRef.current;
    const from = list.findIndex((i) => i.publicId === dragged.id);
    const to = list.findIndex((i) => i.publicId === over.id);
    if (from >= 0 && to >= 0) commit(arrayMove(list, from, to));
  }

  const full = images.length + uploads.filter((u) => !u.error).length >= MAX_PRODUCT_IMAGES;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {s.title}{" "}
          <span className="text-muted-foreground text-sm font-normal">
            ({images.length}/{MAX_PRODUCT_IMAGES})
          </span>
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus />
          {s.add}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label={s.add}
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>
      <p className="text-muted-foreground text-xs">{s.help}</p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {(images.length > 0 || uploads.length > 0) && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((i) => i.publicId)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {images.map((item, index) => (
                <SortableTile
                  key={item.publicId}
                  item={item}
                  index={index}
                  onRemove={() => remove(item)}
                />
              ))}
              {uploads.map((u) => (
                <li
                  key={u.key}
                  className="bg-muted flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center text-xs"
                >
                  <span className="w-full truncate" title={u.name}>
                    {u.name}
                  </span>
                  {u.error ? (
                    <>
                      <span role="alert" className="text-destructive">
                        {u.error}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                      >
                        {t.common.cancel}
                      </Button>
                    </>
                  ) : (
                    <>
                      <progress
                        value={u.progress}
                        max={100}
                        className="w-full"
                        aria-label={s.uploading}
                      />
                      <span className="text-muted-foreground">
                        {s.uploading} {u.progress}%
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
