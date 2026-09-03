# API Contract - Products

Agreed before implementation so frontend and backend can be built in parallel.
Frontend develops against mocks matching these shapes; backend implements to match.

## Product object

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Mongo ObjectId |
| `name` | string | |
| `slug` | string | URL-safe, unique |
| `description` | string | |
| `brand` | string | |
| `price` | number | Selling price in INR |
| `mrp` | number | Original price; UI shows the strike-through |
| `category` | object | `{ _id, name, slug }` - populated ref |
| `images` | array | `[{ url, publicId }]` - Cloudinary |
| `stock` | number | 0 means out of stock |
| `attributes` | object | Free-form specs, e.g. `{ RAM: "16GB" }`. Feeds AI comparison |
| `ratingAvg` | number | 0-5, denormalised from reviews |
| `numReviews` | number | Denormalised |
| `isActive` | boolean | Soft delete |
| `createdAt` | date | |

## GET /api/products

Query params: `q`, `category`, `minPrice`, `maxPrice`, `minRating`, `sort`, `page`, `limit`

`sort` accepts: `newest` (default), `price-asc`, `price-desc`, `rating`

Response `200`:

```json
{
  "success": true,
  "count": 12,
  "total": 48,
  "page": 1,
  "pages": 4,
  "products": [ /* Product objects */ ]
}
```

## GET /api/products/:slug

Response `200`: `{ "success": true, "product": { /* Product */ } }`
Response `404`: `{ "success": false, "message": "Product not found" }`

## Admin endpoints (protect + authorize('admin','superadmin'))

- `POST   /api/products` -> `201` `{ success, product }`
- `PUT    /api/products/:id` -> `200` `{ success, product }`
- `DELETE /api/products/:id` -> `200` `{ success, message }`
