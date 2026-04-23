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

## Beginner Deep Dive: Upload, Download, and Real-time Dashboard

<div class="system-flow-demo">
  <div class="system-flow-title">Large files move through storage and workers while the dashboard watches status</div>
  <div class="flow-lane">
    <div class="flow-node">Signed Upload URL</div>
    <div class="flow-node">Object Storage</div>
    <div class="flow-node">Job Queue</div>
    <div class="flow-node">Worker Processing</div>
    <div class="flow-node">Status Dashboard</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Signed Upload URL

Instead of sending a huge file through the app server, the client receives a temporary signed URL and uploads directly to object storage.

I choose signed URLs because app servers should not spend memory and network capacity proxying large files.

### Object Storage

Object storage holds the raw file and processed output. Metadata such as owner, status, size, and checksum lives in a database.

This keeps large binary data separate from queryable business data.

### Job Queue and Worker

After upload, a job is added to a queue. Workers process files in the background.

I choose a queue because processing can take seconds or minutes. The user should see progress instead of waiting on one long request.

### Status Dashboard

The dashboard reads job status and can update through polling or server-sent events.

I choose polling first for simplicity. I would choose WebSockets if updates need to be very frequent and interactive.

### Failure, Multi-region, and Safe Fallback

**risks**: oversized files, malware, duplicate uploads, failed workers, and stale dashboard status.

**decisions**: enforce size limits, validate file type, scan files, make jobs idempotent, and store status transitions.

For multi-region, store files in the region required by data residency. Processing workers should run near the storage region to reduce latency and compliance risk.

## Follow-up Interview Questions With Answers

**Q: Why direct upload instead of app server upload?**  
A: Direct upload is cheaper and more reliable for large files because object storage is built for that workload.

**Q: How do you show progress?**  
A: Store job state such as queued, processing, succeeded, and failed. The UI polls or subscribes to status changes.

**Q: What if processing fails halfway?**  
A: Mark the job failed, keep the original file, retry if safe, and show a clear error to the user.
