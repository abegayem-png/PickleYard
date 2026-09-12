import { useRef, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { isAcceptedProofFile, uploadPaymentProof } from '../../lib/paymentProofStorage'
import type { PaymentStatus } from '../../types'
import Button from '../ui/Button'
import Card from '../ui/Card'

export default function GcashPaymentSection({
  amount,
  paymentStatus,
  gcashNumber,
  gcashAccountName,
  gcashQrCodeUrl,
  onSubmitProof,
}: {
  amount: number
  paymentStatus: PaymentStatus
  gcashNumber: string
  gcashAccountName: string
  gcashQrCodeUrl: string
  /** Uploads the file, then reports the proof reference to the caller's
   *  store call. Returns the outcome so this component can show the result
   *  without the parent needing to re-fetch just to know if it worked. */
  onSubmitProof: (proofUrl: string) => Promise<{ success: boolean; reason?: string | null }>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!isAcceptedProofFile(f)) {
      setError('Please upload a JPG, JPEG, PNG, or WEBP image.')
      return
    }
    setError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!file) {
      setError('Please upload a screenshot of your GCash payment first.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const proofUrl = await uploadPaymentProof(file)
      const result = await onSubmitProof(proofUrl)
      if (!result.success) {
        setError(result.reason || 'Could not submit your payment proof. Please try again.')
      } else {
        setFile(null)
        setPreview(null)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not submit your payment proof. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const canUpload = paymentStatus === 'unpaid' || paymentStatus === 'rejected'

  return (
    <Card className="mt-4 p-5 text-left">
      <p className="mb-1 text-center font-display text-sm font-extrabold uppercase tracking-widest text-lime-500">
        Pay via GCash
      </p>
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-cream-dim">Amount to Pay</p>
      <p className="text-center font-display text-3xl font-extrabold text-cream">₱{amount}</p>

      {gcashQrCodeUrl && (
        <img
          src={gcashQrCodeUrl}
          alt="GCash QR code"
          className="mx-auto mt-4 h-52 w-52 rounded-xl border border-white/10 bg-white object-contain p-2"
        />
      )}
      <div className="mt-3 space-y-1 text-center text-sm">
        {gcashNumber && <p className="text-cream-dim">GCash Number: <span className="font-semibold text-cream">{gcashNumber}</span></p>}
        {gcashAccountName && <p className="text-cream-dim">Account Name: <span className="font-semibold text-cream">{gcashAccountName}</span></p>}
      </div>

      <p className="mt-4 text-center text-xs text-cream-dim">
        Scan the QR code using GCash and pay the exact amount. After payment, upload a screenshot of your successful transaction.
      </p>

      {paymentStatus === 'verified' && (
        <div className="mt-4 rounded-xl border border-lime-500/30 bg-lime-500/10 px-4 py-3 text-center text-sm font-semibold text-lime-400">
          ✅ Payment Verified
        </div>
      )}

      {paymentStatus === 'pending' && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm font-semibold text-amber-300">
          Payment submitted — waiting for admin verification.
        </div>
      )}

      {paymentStatus === 'rejected' && (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-center text-sm font-semibold text-red-300">
          Your payment could not be verified. Please upload a new screenshot.
        </div>
      )}

      {canUpload && (
        <div className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelected}
            className="hidden"
            id="gcash-proof-input"
          />
          {preview ? (
            <div className="flex items-center gap-3">
              <img src={preview} alt="Payment screenshot preview" className="h-16 w-16 rounded-lg border border-white/10 object-cover" />
              <label htmlFor="gcash-proof-input" className="cursor-pointer text-sm font-semibold text-lime-400 underline">
                Choose a different screenshot
              </label>
            </div>
          ) : (
            <label
              htmlFor="gcash-proof-input"
              className="flex h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-court-800 text-sm font-semibold text-cream-dim hover:border-lime-500/40"
            >
              Upload Payment Screenshot
            </label>
          )}

          {error && <p className="mt-2 text-sm font-medium text-red-400">{error}</p>}

          <Button fullWidth size="lg" className="mt-4" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Payment'}
          </Button>
        </div>
      )}
    </Card>
  )
}
