# Upload/Download Processing Dashboard

## NEXT THING TO SAY

I will design file upload and processing as an asynchronous workflow because large files should not block the user request.

```text
User -> Upload API -> Object Storage -> Job Queue -> Workers -> Status Store -> Dashboard
```

## Step 0: 20-second framing

Success means files upload reliably, processing status is visible, and failed jobs can be retried or explained.

## Section 1: Requirements and scope

**requirements**:

- Upload files.
- Validate file type and size.
- Process files asynchronously.
- Show real-time status.
- Allow download of results.

Safe default: reject unknown file types and keep untrusted files isolated.

## Section 2: Quick capacity and growth

File size and processing time matter more than request count. Large customers can create worker hotspots.

## Section 3: Core API contracts

- `POST /files/upload-url`
- `POST /jobs`
- `GET /jobs/{id}`
- `GET /files/{id}/download-url`

## Section 4: Data model and access patterns

Entities: `File`, `ProcessingJob`, `JobStatus`, `AuditEvent`.

I choose object storage for files because databases are not ideal for large binary content.

## Section 5: High-level architecture

```text
Dashboard
   |
API Service
   |---- Object Storage
   |---- Job Queue
   |---- Status Database
          |
        Workers
```

## Section 6: Key workflows

Upload flow:

- Request upload URL.
- Upload file to storage.
- Create processing job.
- Worker processes file.
- Dashboard polls or subscribes for status.

## Section 7: Deep dive

Failure modes:

- Upload incomplete: expire the upload.
- Worker fails: retry with limit.
- Duplicate job: idempotency key returns existing job.

## Section 8: Reliability, observability, security

Use virus scanning if needed, signed URLs, encryption, job metrics, and audit logs.

## Section 9: Tradeoffs and wrap

- **key decision**: asynchronous processing.
- **tradeoff**: status is not instant, but user request stays fast.
- **risk**: unsafe file content.
- **mitigation**: validation, isolation, and scanning.
