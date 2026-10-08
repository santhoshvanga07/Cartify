import { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

/**
 * Image manager for one product.
 *
 * Note the request is FormData, not JSON - a file cannot be sent as JSON.
 * We deliberately do NOT set a Content-Type header: the browser must generate
 * it, because multipart requires a random boundary string that only it knows.
 * Setting it by hand is the classic cause of "Unexpected end of form".
 */
const ProductImages = ({ product, onChange, enabled = true }) => {
  const [images, setImages] = useState(product.images || []);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  /**
   * Uploads the picked files one at a time. Sequential on purpose: the server
   * enforces the 5-photo limit per request, and parallel uploads would race
   * past it and leave the shopper-facing order of photos random.
   */
  const upload = async (fileList) => {
    const files = [...(fileList || [])];
    if (files.length === 0) return;

    const room = 5 - images.length;
    if (files.length > room) toast.info(`Only ${room} more photo${room === 1 ? '' : 's'} allowed - adding the first ${room}`);

    setUploading(true);
    let added = 0;
    for (const file of files.slice(0, room)) {
      // Check size client-side too: rejecting a 20 MB file here saves a slow
      // upload the server would refuse anyway. The server check is the one that counts.
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is over 5 MB`);
        continue;
      }
      const body = new FormData();
      body.append('image', file);
      try {
        const { data } = await api.post(`/products/${product._id}/images`, body);
        setImages(data.images);
        onChange?.(data.images);
        added++;
      } catch (err) {
        toast.error(`${file.name}: ${err.response?.data?.message || 'upload failed'}`);
      }
    }
    if (added) toast.success(`${added} photo${added === 1 ? '' : 's'} added`);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = ''; // allow re-picking the same file
  };

  const remove = async (publicId) => {
    try {
      const { data } = await api.delete(`/products/${product._id}/images/${publicId}`);
      setImages(data.images);
      onChange?.(data.images);
      toast.success('Image removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove');
    }
  };

  return (
    <div>
      <label className="label">Photos {images.length > 0 && <span className="text-muted">· first one is the cover</span>}</label>

      <div className="flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img.publicId} className="group relative h-20 w-20 overflow-hidden rounded-lg bg-page">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(img.publicId)}
              className="absolute inset-0 flex items-center justify-center bg-ink/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!enabled || uploading || images.length >= 5}
          title={enabled ? undefined : 'Cloudinary is not configured on the server'}
          className="flex h-20 w-20 items-center justify-center rounded-lg bg-page text-xs text-muted transition-colors hover:text-accent disabled:opacity-40"
        >
          {!enabled ? 'Off' : uploading ? 'Uploading…' : images.length >= 5 ? 'Max 5' : '+ Add'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        onChange={(e) => upload(e.target.files)}
        className="hidden"
      />

      <p className="mt-2 text-xs text-muted">
        {enabled
          ? 'JPEG, PNG, WebP or AVIF · up to 5 MB each · max 5 photos · select several at once'
          : 'Photo uploads need Cloudinary keys on the server.'}
      </p>
    </div>
  );
};

export default ProductImages;
