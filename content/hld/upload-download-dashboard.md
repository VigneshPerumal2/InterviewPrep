# Upload/Download Processing Dashboard

## NEXT THING TO SAY

I will design file upload and processing as an asynchronous workflow because large files should not block the user request. The architecture uses signed URLs for direct upload, a job queue for background processing, and real-time status updates via polling or server-sent events.

```text
User -> Upload API -> Object Storage -> Job Queue -> Workers -> Status Store -> Dashboard
```

## Step 0: 20-second framing

Success means files upload reliably even at large sizes, processing status is visible in real time, failed jobs can be retried or explained to the user, and the system scales processing capacity independently from the web tier.

## Section 1: Requirements and scope

**requirements**:

- Upload files up to 500 megabytes with progress tracking.
- Validate file type, size, and content safety (virus scanning).
- Process files asynchronously with visible status updates.
- Show real-time processing status on a dashboard.
- Allow download of processed results via signed URLs.
- Support job priority (urgent vs. normal processing).
- Retry failed processing with clear error reporting.

Non-functional **requirements**:

- Upload initiation response under 200 milliseconds.
- Processing status updates within 5 seconds of state change.
- Support 1,000 concurrent uploads.
- 99.9 percent file durability (no uploaded file lost).
- Processing throughput: 500 files per hour per worker.

Safe default: reject unknown file types and keep untrusted files isolated until virus scan completes.

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>500 MB</strong><span>Max File Size</span></div>
  <div class="capacity-metric"><strong>1,000</strong><span>Concurrent Uploads</span></div>
  <div class="capacity-metric"><strong>5s</strong><span>Status Freshness</span></div>
  <div class="capacity-metric"><strong>500/hr</strong><span>Processing/Worker</span></div>
</div>

File size and processing time matter more than request count. Large customers can create worker hotspots by submitting many large files simultaneously.

**Storage math**: If average file is 50 MB and we process 10,000 files per day, daily input storage is 500 GB. With processed output averaging 10 MB per file, daily output is 100 GB. Total monthly storage (input + output): approximately 18 TB before cleanup.

## Section 3: Core API contracts

```text
POST /files/upload-url
  Body: filename, content_type, size_bytes
  Response 200:
    upload_url       string    (presigned S3/GCS PUT URL, expires in 15 min)
    upload_id        string    (tracking reference)
    max_size_bytes   integer   (enforced at storage level)

POST /jobs
  Body: upload_id, processing_type, priority (normal/urgent), callback_url (optional)
  Response 201:
    job_id           string
    status           string    (queued)
    estimated_wait   string    (e.g. "~5 minutes")

GET /jobs/{id}
  Response:
    job_id           string
    status           string    (queued, processing, completed, failed)
    progress         integer   (0-100 percent)
    result_url       string    (presigned download URL, if completed)
    error            object    (error code and message, if failed)
    created_at       string
    updated_at       string

GET /files/{id}/download-url
  Response:
    download_url     string    (presigned GET URL, expires in 1 hour)
    filename         string
    size_bytes       integer
    content_type     string
```

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">processing_jobs</div>
  <div class="schema-field"><span class="schema-field-name">job_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">upload_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">status</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">queued, processing, completed, failed</span></div>
  <div class="schema-field"><span class="schema-field-name">priority</span><span class="schema-field-type">INTEGER</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">0=urgent, 1=normal, 2=low</span></div>
  <div class="schema-field"><span class="schema-field-name">progress_pct</span><span class="schema-field-type">INTEGER</span><span class="schema-field-note">0 to 100</span></div>
  <div class="schema-field"><span class="schema-field-name">input_key</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">Object storage key for input file</span></div>
  <div class="schema-field"><span class="schema-field-name">output_key</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">Object storage key for result</span></div>
  <div class="schema-field"><span class="schema-field-name">error_code</span><span class="schema-field-type">VARCHAR</span></div>
  <div class="schema-field"><span class="schema-field-name">error_message</span><span class="schema-field-type">TEXT</span></div>
  <div class="schema-field"><span class="schema-field-name">retry_count</span><span class="schema-field-type">INTEGER</span></div>
  <div class="schema-field"><span class="schema-field-name">worker_id</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">Which worker claimed this job</span></div>
  <div class="schema-field"><span class="schema-field-name">created_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">started_at</span><span class="schema-field-type">TIMESTAMP</span></div>
  <div class="schema-field"><span class="schema-field-name">completed_at</span><span class="schema-field-type">TIMESTAMP</span></div>
</div>

I choose object storage for files because databases are not ideal for large binary content. Object storage is designed for this: high durability (11 nines), cost-effective, and supports presigned URLs for direct client access.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">File processing with priority queues and real-time status</div>
  <div class="flow-multi-label">Upload path (client to storage)</div>
  <div class="flow-multi-row">
    <div class="flow-node">Client</div>
    <div class="flow-node">API: Get Upload URL</div>
    <div class="flow-node">Direct Upload to S3</div>
    <div class="flow-node">Virus Scan Trigger</div>
  </div>
  <div class="flow-multi-label">Processing path (background workers)</div>
  <div class="flow-multi-row">
    <div class="flow-node">Priority Job Queue</div>
    <div class="flow-node">Worker Claims Job</div>
    <div class="flow-node">Process File</div>
    <div class="flow-node-success">Store Result in S3</div>
  </div>
  <div class="flow-multi-label">Dashboard path (real-time status)</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Status Database</div>
    <div class="flow-node-success">SSE / Polling</div>
    <div class="flow-node-success">Dashboard UI</div>
    <div class="flow-node-success">Webhook Callback</div>
  </div>
</div>

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Complete upload-to-result workflow</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Client requests upload URL</strong><span>API validates file type against allowlist (PDF, CSV, XLSX, PNG, JPG). Validates size does not exceed merchant-specific limit. Returns a presigned PUT URL valid for 15 minutes. <span class="seq-step-fail">Invalid type → 400 with allowed types list</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Client uploads directly to object storage</strong><span>Client uses the presigned URL to upload the file directly. No file bytes pass through the API server. Multipart upload for files over 100 MB. Client can show upload progress bar. <span class="seq-step-fail">Upload timeout → client retries with same URL</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Object storage notifies API</strong><span>S3 event notification triggers a Lambda or webhook. API confirms upload completion, records file metadata, and triggers virus scanning. <span class="seq-step-fail">Notification missed → periodic scan for orphan uploads</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Virus scan runs</strong><span>Scan file in an isolated environment. If clean, mark as safe. If infected, quarantine file and notify user. File is not processed until scan completes. <span class="seq-step-fail">Infected → quarantine + notify + reject job</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Client creates processing job</strong><span>Job enters priority queue. Urgent jobs are processed before normal jobs. Job status set to "queued" with estimated wait time. Idempotency key prevents duplicate jobs for same file. <span class="seq-step-fail">Duplicate job → return existing job_id</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Worker claims and processes job</strong><span>Worker atomically claims a job by setting status to "processing" and worker_id. Downloads file from S3, processes it, updates progress percentage periodically. Stores result in S3. <span class="seq-step-fail">Worker crash → job timeout (10 min), auto-retry</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Dashboard shows real-time status</strong><span>Dashboard polls GET /jobs/{id} every 3 seconds, or uses Server-Sent Events for push updates. Shows progress bar, status, and download link when complete. <span class="seq-step-fail">Status query failure → show "loading" with last known state</span></span></div></div>
</div>

### Multipart upload for large files

Files over 100 MB use multipart upload:

1. Client requests multipart upload initiation.
2. API returns an upload ID.
3. Client uploads file in 10 MB chunks, each with its own presigned URL.
4. Client can upload chunks in parallel (5 concurrent chunks).
5. After all chunks complete, client calls complete-multipart API.
6. If upload is interrupted, client can resume from the last completed chunk.

### Job priority and fairness

Priority queue with three levels:

| Priority | Use Case | Processing Order | Max Wait |
|---|---|---|---|
| Urgent (0) | Critical compliance reports | First | 5 minutes |
| Normal (1) | Standard processing | After urgent | 30 minutes |
| Low (2) | Bulk batch jobs | After normal | 2 hours |

**Fairness**: Within the same priority level, jobs are processed in FIFO order. A single merchant cannot monopolize workers. If one merchant has 500 queued jobs, other merchants' jobs still get workers allocated proportionally.

## Section 7: Deep dive

### Real-time status update strategies

<div class="compare-grid">
  <div class="compare-card">
    <h4>Polling (Recommended Start)</h4>
    <ul>
      <li>Client sends GET every 3-5 seconds</li>
      <li>Simplest to implement</li>
      <li>Works through all proxies and firewalls</li>
      <li>Slightly higher server load</li>
      <li>Status delay: up to poll interval</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Server-Sent Events (SSE)</h4>
    <ul>
      <li>Server pushes updates as they happen</li>
      <li>Lower latency (instant updates)</li>
      <li>One-directional (server to client)</li>
      <li>Auto-reconnect built into browsers</li>
      <li>Good for dashboards with many active jobs</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>WebSocket</h4>
    <ul>
      <li>Full bidirectional communication</li>
      <li>Lowest latency</li>
      <li>More complex to implement and scale</li>
      <li>Overkill for status-only updates</li>
      <li>Best for interactive collaboration features</li>
    </ul>
  </div>
</div>

### Failure modes

- Upload incomplete: Expire the presigned URL after 15 minutes. Orphan detection runs hourly to clean up incomplete uploads.
- Worker crashes: Job status remains "processing." A heartbeat monitor detects jobs stuck for over 10 minutes and requeues them.
- Processing fails: Mark as failed with error code and message. Allow retry up to 3 times. After max retries, notify user with actionable error.
- Duplicate job: Idempotency key (upload_id + processing_type) returns existing job instead of creating a new one.

## Section 8: Reliability, observability, security

**Security layers**: virus scanning before processing, presigned URLs with expiration for both upload and download, encryption at rest and in transit, file type allowlist enforcement at both API and storage levels.

**Key metrics**: upload success rate, processing queue depth, processing time per file type, worker utilization, retry rate, virus detection rate.

Use signed URLs with expiration, encryption, job metrics, and audit logs.

## Section 9: Tradeoffs and wrap

- **key decision**: asynchronous processing with priority queue.
- **key decision**: direct upload to object storage via presigned URLs.
- **tradeoff**: status is not instant but user request stays fast (sub-200ms).
- **tradeoff**: virus scanning adds processing delay but is essential for security.
- **risk**: unsafe file content bypassing security checks.
- **mitigation**: mandatory virus scan before processing, file type allowlist, and size limits.
- **risk**: worker capacity exhaustion during bulk uploads.
- **mitigation**: per-merchant job limits, priority queues, and auto-scaling workers.

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

I choose signed URLs because app servers should not spend memory and network capacity proxying large files. A 500 MB file upload through the API server would consume 500 MB of memory and block a thread for minutes. Signed URLs offload this entirely to object storage, which is built for this workload.

### Object Storage

Object storage holds the raw file and processed output. Metadata such as owner, status, size, content type, and virus scan status lives in a database.

This separation keeps large binary data separate from queryable business data. You can scale storage (petabytes) independently from the database.

### Job Queue and Worker

After upload confirmation, a job is added to the priority queue. Workers poll the queue, claim jobs atomically, and process files in the background.

I choose a queue because processing can take seconds to minutes depending on file size and type. The user should see progress updates instead of waiting on one long HTTP request that might time out.

**Worker claiming**: Workers use atomic compare-and-swap to claim jobs (UPDATE ... SET status = 'processing', worker_id = X WHERE status = 'queued' LIMIT 1). This prevents two workers from processing the same job.

### Status Dashboard

The dashboard reads job status and can update through polling or server-sent events.

I choose polling first for simplicity. Each poll is a lightweight GET request. I would add SSE if the dashboard needs to show many active jobs with sub-second updates.

### Failure, Multi-region, and Safe Fallback

**risks**: oversized files bypassing validation, malware in uploaded files, duplicate uploads creating duplicate processing, workers crashing mid-processing, and stale dashboard status.

**decisions**: enforce size limits at both API and storage level, mandatory virus scanning with quarantine, make jobs idempotent with upload_id-based deduplication, heartbeat monitoring for stuck workers, and status transitions with timestamps.

For multi-region, store files in the region required by data residency. Processing workers should run near the storage region to reduce latency and compliance risk.

## Follow-up Interview Questions With Answers

**Q: Why direct upload instead of app server upload?**  
A: Direct upload is cheaper, more reliable, and more scalable for large files. Object storage is purpose-built for high-throughput file handling. App servers would need large memory buffers and long timeouts, reducing their capacity for API requests.

**Q: How do you show progress?**  
A: Workers update a progress_pct field in the database as they process (e.g., every 10 percent). The dashboard polls this field every 3-5 seconds. For multipart processing, progress maps to the percentage of parts completed.

**Q: What if processing fails halfway?**  
A: Mark the job as failed with a clear error code and message. Keep the original file intact. Allow retry up to 3 times. If the same error recurs, notify the user with actionable guidance (e.g., "file is corrupted, please re-upload"). Store partial results if they have value.

**Q: How do you prevent one merchant from monopolizing all workers?**  
A: Fair scheduling within priority levels. If merchant A has 500 jobs and merchant B has 5 jobs, workers interleave: process one from A, one from B, one from A, etc. This ensures merchant B's jobs are processed promptly even during merchant A's bulk upload.

**Q: How do you handle files that take very long to process?**  
A: Set a maximum processing time per file type (e.g., 30 minutes for video, 5 minutes for CSV). If exceeded, mark as timed out. Provide guidance to the user: "file may be too large for this processing type." Offer to break large files into smaller batches.
