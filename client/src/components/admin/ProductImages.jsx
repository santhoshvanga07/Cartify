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
const ProductImages = ({ product, onChange }) => {
  const [images, setImages] = useState(product.images || []);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;

    // Check size client-side too: rejecting a 20 MB file here saves the user
    // a slow upload that the server would refuse anyway. The server check is
    // the one that counts.
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('Image must be 5 MB or smaller');
    }

    const body = new FormData();
    body.append('image', file);

    setUploading(true);
    try {
      const { data } = await api.post(`/products/${product._id}/images`, body);
      setImages(data.images);
      onChange?.(data.images);
      toast.success('Image added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = ''; // allow re-picking the same file
    }
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
      <label className="label">Images</label>

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
          disabled={uploading || images.length >= 5}
          className="flex h-20 w-20 items-center justify-center rounded-lg bg-page text-xs text-muted transition-colors hover:text-accent disabled:opacity-40"
        >
          {uploading ? 'Uploading…' : images.length >= 5 ? 'Max 5' : '+ Add'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => upload(e.target.files?.[0])}
        className="hidden"
      />

      <p className="mt-2 text-xs text-muted">JPEG, PNG, WebP or AVIF · up to 5 MB · max 5 images</p>
    </div>
  );
};

export default ProductImages;
