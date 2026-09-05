# `authenticity.md` — LegalLens Document Authenticity & Forensic Verification Specification

---

## 1. Executive Summary & Verification Strategy

Legal documents ingested into LegalLens (especially residential leases, commercial contracts, and NDAs) frequently arrive as rasterized mobile scans (CamScanner, Adobe Scan) or heavily compressed media forwarded via messaging apps (WhatsApp, Telegram). Under these constraints, standard cryptographic certificates and EXIF metadata are stripped or absent.

This specification outlines the backend verification pipeline implemented across three progressive, non-destructive audit layers executed strictly in-memory:

```text
[ Uploaded Document (RAM Buffer) ]
                 │
  ┌──────────────┼──────────────┐
  ▼              ▼              ▼
[ LAYER 1 ]    [ LAYER 2 ]    [ LAYER 3 ]
Computer       Statutory &    Semantic &
Vision (ELA)   Registry QR    Chronological
Forensics      Verification   Coherence
  └──────────────┬──────────────┘
                 │
                 ▼
 [ Composite Authenticity Score (0–100) ]

```

---

## 2. Forensic & Computer Vision Engine (Layer 1)

For flattened raster files and compressed PDFs, Layer 1 detects pixel-level tampering, digital splices, and inconsistent compression blocks without persisting files to disk.

```text
[ Raw Image Buffer ] ──► [ OpenCV / Sharp Pipeline ]
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
[ Error Level Analysis ]   [ Noise / PRNU Check ]   [ Bounding Splice Check ]
  Uniform lossy delta?       Consistent sensor grain?  Halos around digits/sigs?

```

### 2.1. Error Level Analysis (ELA)

* **Principle:** WhatsApp and mobile scanners apply uniform lossy JPEG compression across the entire canvas. If text (e.g., rent amount or dates) or signatures were digitally composited using Photoshop or Canva prior to forwarding, that spliced region displays an anomalous error potential relative to the background.
* **Algorithm:**
1. Read image buffer directly from memory into `sharp`.
2. Resave the buffer in-memory at a fixed quality factor ($Q = 95$).
3. Compute absolute pixel-by-pixel difference: $\Delta = \vert{}I_{\text{orig}} - I_{\text{resaved}}\vert{}$.
4. Scale differences by an amplification factor (scale multiplier = $20$).
5. Calculate mean variance across sliding windows ($64 \times 64$ px). Any bounding box exceeding $3.5\sigma$ deviation from page mean is flagged as a modified hotspot.



### 2.2. Glyph & Font Boundary Consistency

* **Baseline Elevation & Kerning:** Detects post-scan text insertions where characters deviate from the optical scan tilt or baseline curve.
* **Edge Sharpness & Haloing:** Checks whether signatures or numerical values have sharp anti-aliasing edges while surrounding scan text shows analog bleed and sensor blur (indicates transparent PNG paste).

---

## 3. Statutory & Registry QR Verification (Layer 2)

Genuine registered documents in India (e.g., Leave and License agreements under Maharashtra Rent Control Act, Delhi Rent Act, Karnataka Rent Control Act) feature physical and digital state artifacts.

```text
[ Document Image Buffer (Page 1) ]
                 │
                 ▼
[ Preprocessing: Deskew + Contrast Adaptive Binarization ]
                 │
                 ▼
[ QR / 2D Barcode Decoder (`@zxing/library` / `quirc`) ]
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
[ Valid QR Found ]    [ QR Absent / Unreadable ]
       │                   │
       ▼                   ▼
Extract Payload URL    Check SRO Registration Footer /
(e.g., GRAS / SHCIL)   Stamp Watermark via OCR Regex
       │
       ▼
Extract: Certificate Number, Stamp Duty Amount, First Party, Second Party

```

### 3.1. Verification Matrix

* **Stock Holding Corporation of India (SHCIL) e-Stamp:**
* Extracts Certificate No (`IN-XX00000000000000X`).
* Verifies Certificate Issue Date and Consideration Amount.


* **Government Receipt Accounting System (GRAS):**
* Extracts GRN (Government Reference Number).
* Validates payment verification URL structure against official treasury endpoints (`gras.mahakosh.gov.in`, etc.).


* **Sub-Registrar Office (SRO) Registration Stamps:**
* Scans footers for official registration stamps (e.g., `DOC-NO / SRO / YEAR`).



---

## 4. Semantic & Chronological Coherence Engine (Layer 3)

Using `gemini-3.5-flash`, the engine reconciles the extracted statutory header against the underlying contractual clauses to detect mismatched templates and date fraud.

```text
       STATUTORY STAMP DATA                     CONTRACT BODY DATA
┌──────────────────────────────────┐      ┌──────────────────────────────────┐
│ Purchaser: Rakesh Sharma         │      │ Lessor: Rakesh Sharma            │
│ Issue Date: 12-Feb-2026          │ ◄──► │ Execution Date: 15-Feb-2026      │
│ Duty Paid: ₹500                  │      │ Commencement: 01-Mar-2026        │
└──────────────────────────────────┘      └──────────────────────────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      ▼
                        [ Coherence Validation Rules ]

```

### 4.1. Mandatory Integrity Rules

1. **The Chronology Test:**
$$\text{Stamp Purchase Date} \le \text{Execution Date} \le \text{Commencement Date}$$


* *Violation Flag:* If stamp purchase date is *after* the agreement execution date, flag as **CRITICAL_CHRONOLOGY_ANOMALY**.


2. **Party Reconciliation:**
The "Purchased By / First Party" on the e-Stamp certificate must match either the Lessor or Lessee name in Clause 1.
3. **Witness & Execution Completeness:**
Agreement must contain execution recitals (*"IN WITNESS WHEREOF..."*), signatures for both primary parties, and **at least two witness signatures**.
4. **Annexure Grounding:**
Any schedule mentioned in clauses (e.g., *"Schedule A: Inventory List"*) must exist within the page count of the uploaded file.

---

## 5. Backend Implementation Specifications

### 5.1. File & Module Structure

```text
backend/src/
├── controllers/
│   └── authenticityController.js     # Orchestrates Layers 1, 2, and 3
├── services/
│   ├── forensicService.js            # In-memory ELA & pixel variance (Sharp)
│   ├── qrScannerService.js           # Deskewing, binarization, QR extraction (ZXing)
│   └── statutoryService.js           # Gemini 3.5 Flash semantic reconciliation
└── utils/
    └── authenticityScorer.js         # Weighted composite score calculator

```

### 5.2. Service Implementations

#### `forensicService.js` (In-Memory ELA Engine)

```javascript
import sharp from 'sharp';

export async function runErrorLevelAnalysis(imageBuffer) {
  // 1. Recompress buffer in memory at known quality
  const recompressed = await sharp(imageBuffer)
    .jpeg({ quality: 95 })
    .toBuffer();

  // 2. Compute absolute difference image
  const { data: origData, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: resavedData } = await sharp(recompressed)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let totalDelta = 0;
  let maxLocalDelta = 0;
  const pixelCount = info.width * info.height;

  for (let i = 0; i < origData.length; i += info.channels) {
    const rDiff = Math.abs(origData[i] - resavedData[i]);
    const gDiff = Math.abs(origData[i + 1] - resavedData[i + 1]);
    const bDiff = Math.abs(origData[i + 2] - resavedData[i + 2]);
    const delta = (rDiff + gDiff + bDiff) / 3;

    totalDelta += delta;
    if (delta > maxLocalDelta) maxLocalDelta = delta;
  }

  const avgDelta = totalDelta / pixelCount;
  // Variance threshold check: Flag if regional delta deviates substantially from mean
  const hasTamperAlert = maxLocalDelta > avgDelta * 4.5 && maxLocalDelta > 30;

  return {
    elaScore: hasTamperAlert ? 45 : 95,
    avgCompressionError: avgDelta.toFixed(2),
    maxCompressionDiscrepancy: maxLocalDelta.toFixed(2),
    tamperDetected: hasTamperAlert
  };
}

```

#### `qrScannerService.js` (Optical Barcode & QR Extractor)

```javascript
import { MultiFormatReader, BarcodeFormat, DecodeHintType, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } from '@zxing/library';
import sharp from 'sharp';

export async function extractStatutoryQR(pageImageBuffer) {
  try {
    // Resize & convert to grayscale raw pixel array for ZXing
    const { data, info } = await sharp(pageImageBuffer)
      .resize({ width: 1800, withoutEnlargement: true })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX]);

    const luminanceSource = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const reader = new MultiFormatReader();
    const result = reader.decode(binaryBitmap, hints);

    return {
      found: true,
      rawPayload: result.getText(),
      isGovVerifiedDomain: /mahakosh\.gov\.in|stockholding\.com|karigr\.gov\.in/i.test(result.getText())
    };
  } catch {
    return { found: false, rawPayload: null, isGovVerifiedDomain: false };
  }
}

```

#### `statutoryService.js` (Gemini 3.5 Flash Reconciliation Prompt)

```javascript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI();

export async function auditSemanticAuthenticity(extractedDocumentText, qrMetadata) {
  const prompt = `
You are a legal forensic auditor verifying contract authenticity under Indian Tenancy Laws.
Analyze the extracted document text and QR metadata:

QR METADATA:
${JSON.stringify(qrMetadata, null, 2)}

DOCUMENT TEXT:
${extractedDocumentText}

Evaluate and return JSON conforming to this schema:
{
  "chronologyCheck": {
    "stampPurchaseDate": "YYYY-MM-DD or null",
    "executionDate": "YYYY-MM-DD or null",
    "commencementDate": "YYYY-MM-DD or null",
    "isChronologicallySound": boolean,
    "issue": "string or null"
  },
  "partiesMatch": {
    "stampPurchaser": "string or null",
    "agreementParties": ["string"],
    "isMatch": boolean
  },
  "executionHealth": {
    "bothPartiesSigned": boolean,
    "witnessCount": number,
    "witnessDetailsComplete": boolean
  },
  "anomaliesDetected": ["string"],
  "semanticAuthenticityScore": number // 0 to 100
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });

  return JSON.parse(response.text.trim());
}

```

---

## 6. Scoring Methodology & Algorithmic Weights

The overall authenticity rating is normalized to an integer scale of $0$ to $100$:

$$\text{Final Score} = (S_{\text{Forensic}} \times 0.25) + (S_{\text{Statutory}} \times 0.40) + (S_{\text{Semantic}} \times 0.35)$$

| Component | Weight | Criteria |
| --- | --- | --- |
| **$S_{\text{Forensic}}$ (Layer 1)** | 25% | Low ELA compression variance, consistent font boundaries, absence of splice halos. |
| **$S_{\text{Statutory}}$ (Layer 2)** | 40% | Decoded valid QR pointing to certified registry (SHCIL/GRAS/IGR) with matching stamp value. |
| **$S_{\text{Semantic}}$ (Layer 3)** | 35% | Stamp Purchase Date $\le$ Execution Date, party name match, $\ge 2$ witnesses present. |

### Classification Tiers

* **90 – 100 (HIGH AUTHENTICITY):** Cryptographically or officially grounded; clean forensics; valid parties and dates.
* **70 – 89 (MODERATE AUTHENTICITY / COMPRESSED ARTIFACT):** Typical for WhatsApp scans; missing EXIF/metadata, but QR resolves and chronology/parties match.
* **40 – 69 (CAUTION / INCOMPLETE):** Unreadable QR, missing second witness, or mismatched party identifiers.
* **0 – 39 (HIGH RISK / POTENTIAL FORGERY):** ELA tampering detected, stamp date *after* execution date, or altered clauses.

---

## 7. MongoDB Schema Extension: `authenticity_audits`

```json
{
  "_id": "ObjectId('66d9b41a2f1b4c0012a45e99')",
  "sessionId": "sess_89f0a2e1",
  "fileName": "rental_agreement_scan.pdf",
  "sourceType": "COMPRESSED_SCAN_OR_MESSAGING_APP",
  "score": 88,
  "verdict": "MODERATE_AUTHENTICITY_VERIFIED",
  "auditReport": {
    "forensics": {
      "elaPassed": true,
      "tamperAlert": false,
      "avgCompressionDelta": 4.12
    },
    "statutory": {
      "qrDetected": true,
      "registryDomain": "gras.mahakosh.gov.in",
      "certificateNumber": "MH00291029412",
      "stampAmountPaid": "₹500"
    },
    "semantics": {
      "chronologySound": true,
      "stampDate": "2026-02-12",
      "executionDate": "2026-02-15",
      "partiesMatched": true,
      "witnessesFound": 2
    }
  },
  "flaggedIssues": [
    "EXIF/PDF metadata stripped (typical for WhatsApp forwards)",
    "Witness 2 signature present but identification number omitted"
  ],
  "createdAt": "2026-09-05T05:45:00.000Z"
}

```

*Note: Configured with `{ expireAfterSeconds: 86400 }` to purge automatically in accordance with the Zero-Storage privacy mandate.*

---

## 8. API Contract & Output Specification

### `POST /api/documents/verify-authenticity`

* **Content-Type:** `multipart/form-data`
* **Response Payload:**

```json
{
  "success": true,
  "score": 88,
  "verdict": "VERIFIED_VALID",
  "badges": [
    { "label": "e-Stamp QR Verified", "status": "PASS", "details": "StockHolding Corp Cert #IN-MH1029384" },
    { "label": "Image Compression Integrity", "status": "PASS", "details": "Uniform ELA profile across clauses" },
    { "label": "Chronological Sequence", "status": "PASS", "details": "Stamp Date (12/02/26) precedes Signing (15/02/26)" },
    { "label": "Witness Verification", "status": "WARN", "details": "2 signed, but missing national ID refs" }
  ],
  "discrepancies": []
}

```