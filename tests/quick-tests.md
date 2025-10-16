# Quick tests / cURL snippets

These snippets exercise: login -> refresh -> access /hangfire (protected) -> call an admin endpoint.

Note: API base: http://localhost:5000 (or https://localhost:5001 if HTTPS)

1) Login (POST /api/auth/login)

```bash
curl -i -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}' \
  -c cookies.txt
```

- The response body contains the access token. The refresh cookie will be saved in cookies.txt.

2) Use access token to call an admin endpoint (GET /api/users)

```bash
curl -i http://localhost:5000/api/users \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN>" \
  -b cookies.txt
```

3) Refresh access token (POST /api/auth/refresh) — uses cookie

```bash
curl -i -X POST http://localhost:5000/api/auth/refresh \
  -b cookies.txt -c cookies.txt
```

- New access token will be returned in response body and refresh cookie rotated in cookies.txt.

4) Access Hangfire dashboard (GET /hangfire) — must be authenticated and have admin role

Use browser with the access token supplied via Authorization header or configure the app to accept a cookie-based auth.

5) Example: retry a failed task (admin-only)

```bash
curl -i -X POST http://localhost:5000/api/failedtasks/1/retry \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -b cookies.txt
```


Optional: Postman collection can be generated if you want — tell me and I'll add a v2.1 collection file.
