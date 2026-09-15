The public read-only JSON API for dataset consumers.

# Public API

Read-only endpoints for dataset consumers (rate limit: 120 requests / minute / IP):

- `GET /api/mutants` – paginated list. Filters: `project=owner/repo`, `language`, `operator`,
  `reviewStatus`, `mutationStatus`, `contributor`, `commit`, `file`, `q`, `page`, `pageSize`.
- `GET /api/mutants/:id` – full record with diff, test evidence, validations and history.
- `GET /api/docs` – OpenAPI 3.1 description of the above.

```json
{
  "id": 182,
  "repository": "bitcoin/bitcoin",
  "commit": "9b2e4d6f8a0c1e3b5d7f9a1c3e5b7d9f1a3c5e7b",
  "file": "src/script/interpreter.cpp",
  "startLine": 60,
  "endLine": 60,
  "reviewStatus": "APPROVED",
  "mutationStatus": "SURVIVED",
  "reproductions": 4,
  "reproductionSummary": {
    "survived": 4,
    "killed": 0,
    "couldNotReproduce": 0,
    "consensus": "SURVIVED"
  }
}
```

The serializers in `src/server/api/serializers.ts` define the stable dataset shape; CSV/JSON
bulk exports can be added on top of them.
