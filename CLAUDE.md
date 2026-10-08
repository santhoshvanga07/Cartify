# Working on Cartify

- **Commit and push directly to `main`.** The team wants every change on `main`; do not leave work on a
  feature branch or open pull requests unless asked.
- Never commit `.env` files or credentials. `server/.env` and `client/.env` are git-ignored; keys go there
  (or in the host's environment variables), and `server/.env.example` documents them with blank values.
- Before pushing: `cd client && npm run lint && npm run build`, and run the server test scripts touched by
  the change (`cd server && npm run test:<name>`; see `server/package.json`).
