/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";

import {
  Card,
  Typography,
  Divider,
  Input,
  Textarea,
  Button,
  Alert,
} from "@/components/ui";

type UploadResult = {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

const schema = Yup.object({
  fullName: Yup.string().trim().min(2).required("Name is required"),
  title: Yup.string().trim().min(2).required("Title is required"),
  phone: Yup.string().trim().min(6).required("Phone is required"),
  email: Yup.string().trim().email("Invalid email").required("Email is required"),
  address: Yup.string().trim().min(2).required("Address is required"),
  extra: Yup.string().trim().max(1200).optional(),
});

export default function OutlookSignaturePage() {
  const [original, setOriginal] = React.useState<UploadResult | null>(null);
  const [enhanced, setEnhanced] = React.useState<UploadResult | null>(null);
  const [signatureHtml, setSignatureHtml] = React.useState("");
  const [busyUpload, setBusyUpload] = React.useState(false);
  const [busyEnhance, setBusyEnhance] = React.useState(false);
  const [busyGenerate, setBusyGenerate] = React.useState(false);
  const [err, setErr] = React.useState<string>("");

  const userLogoUrl = enhanced?.secure_url || original?.secure_url || "";

  const formik = useFormik({
    initialValues: {
      fullName: "Erick Santos",
      title: "Operations / Integration",
      phone: "+51 999 999 999",
      email: "designsupport@inszoneins.com",
      address: "Lima, Perú",
      extra: "",
    },
    validationSchema: schema,
    onSubmit: async (values) => {
      setErr("");
      setBusyGenerate(true);
      setSignatureHtml("");

      try {
        const r = await fetch("/api/outlook-signature/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            userLogoUrl: userLogoUrl || undefined,
          }),
        });

        const json = await r.json();
        if (!r.ok) throw new Error(json?.error || "Could not generate the signature");

        setSignatureHtml(json.html);
      } catch (e: any) {
        setErr(e?.message || "Error generating signature");
      } finally {
        setBusyGenerate(false);
      }
    },
  });

  async function handleUpload(file: File) {
    setErr("");
    setBusyUpload(true);
    setOriginal(null);
    setEnhanced(null);
    setSignatureHtml("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const r = await fetch("/api/outlook-signature/upload", { method: "POST", body: fd });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || "Upload failed");

      setOriginal(json);

      // simple low-quality warning
      if ((json?.width ?? 0) < 300 || (json?.height ?? 0) < 300) {
        setErr("⚠️ The logo looks small. AI can help, but ideally upload a large PNG or an SVG.");
      }
    } catch (e: any) {
      setErr(e?.message || "Error uploading image");
    } finally {
      setBusyUpload(false);
    }
  }

  async function handleEnhance() {
    if (!original?.secure_url) return;
    setErr("");
    setBusyEnhance(true);
    setEnhanced(null);
    setSignatureHtml("");

    try {
      const r = await fetch("/api/outlook-signature/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: original.secure_url }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || "Enhance failed");

      setEnhanced(json);
    } catch (e: any) {
      setErr(e?.message || "Error enhancing logo");
    } finally {
      setBusyEnhance(false);
    }
  }

  async function copyHtml(html: string) {
    try {
      const blobHtml = new Blob([html], { type: "text/html" });
      const plain = stripHtml(html);
      const blobTxt = new Blob([plain], { type: "text/plain" });

      const item = new ClipboardItem({ "text/html": blobHtml, "text/plain": blobTxt });
      await navigator.clipboard.write([item]);
    } catch {
      await navigator.clipboard.writeText(html);
    }
  }

  function stripHtml(html: string) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.innerText || div.textContent || "";
  }

  return (
    <>
        <Typography variant="h2">Outlook Signature Generator</Typography>
        <Typography variant="bodySm" className="opacity-80 mt-0.5">
          Formik + Yup + custom UI. Upload your logo, optionally enhance it with AI, and generate compatible HTML.
        </Typography>

        <Divider className="my-4" />

        {err && (
          <Alert tone="warning" variant="soft" className="mb-4">
            {err}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LEFT */}
          <div>
            <form onSubmit={formik.handleSubmit}>
              <div className="flex flex-col gap-3">
                <div>
                  <Typography variant="label" as="label" className="mb-1.5 block">Name</Typography>
                  <Input name="fullName" value={formik.values.fullName} onChange={formik.handleChange} onBlur={formik.handleBlur} invalid={Boolean(formik.touched.fullName && formik.errors.fullName)} />
                  {formik.touched.fullName && formik.errors.fullName && (
                    <Typography variant="caption" color="error-600" className="mt-1 block">
                      {formik.errors.fullName}
                    </Typography>
                  )}
                </div>

                <div>
                  <Typography variant="label" as="label" className="mb-1.5 block">Title</Typography>
                  <Input name="title" value={formik.values.title} onChange={formik.handleChange} onBlur={formik.handleBlur} invalid={Boolean(formik.touched.title && formik.errors.title)} />
                  {formik.touched.title && formik.errors.title && (
                    <Typography variant="caption" color="error-600" className="mt-1 block">
                      {formik.errors.title}
                    </Typography>
                  )}
                </div>

                <div>
                  <Typography variant="label" as="label" className="mb-1.5 block">Phone</Typography>
                  <Input name="phone" value={formik.values.phone} onChange={formik.handleChange} onBlur={formik.handleBlur} invalid={Boolean(formik.touched.phone && formik.errors.phone)} />
                  {formik.touched.phone && formik.errors.phone && (
                    <Typography variant="caption" color="error-600" className="mt-1 block">
                      {formik.errors.phone}
                    </Typography>
                  )}
                </div>

                <div>
                  <Typography variant="label" as="label" className="mb-1.5 block">Email</Typography>
                  <Input name="email" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} invalid={Boolean(formik.touched.email && formik.errors.email)} />
                  {formik.touched.email && formik.errors.email && (
                    <Typography variant="caption" color="error-600" className="mt-1 block">
                      {formik.errors.email}
                    </Typography>
                  )}
                </div>

                <div>
                  <Typography variant="label" as="label" className="mb-1.5 block">Address</Typography>
                  <Input name="address" value={formik.values.address} onChange={formik.handleChange} onBlur={formik.handleBlur} invalid={Boolean(formik.touched.address && formik.errors.address)} />
                  {formik.touched.address && formik.errors.address && (
                    <Typography variant="caption" color="error-600" className="mt-1 block">
                      {formik.errors.address}
                    </Typography>
                  )}
                </div>

                <div>
                  <Typography variant="label" as="label" className="mb-1.5 block">Other</Typography>
                  <Textarea
                    name="extra"
                    minRows={3}
                    value={formik.values.extra}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </div>

                <Divider className="my-2" />

                <div>
                  <Typography variant="label" as="label" className="mb-1.5 block">Custom logo (user)</Typography>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleUpload(f);
                    }}
                    disabled={busyUpload}
                  />
                </div>

                <div className="flex flex-row gap-2">
                  <Button
                    variant="soft"
                    onClick={handleEnhance}
                    disabled={!original?.secure_url || busyEnhance}
                  >
                    {busyEnhance ? "Enhancing..." : "Enhance with AI"}
                  </Button>

                  <Button type="submit" disabled={!formik.isValid || busyGenerate}>
                    {busyGenerate ? "Generating..." : "Generate signature"}
                  </Button>
                </div>
              </div>
            </form>

            <Divider className="my-4" />

            <Typography variant="h5" className="mb-1">
              Logos
            </Typography>
            <div className="grid grid-cols-2 gap-4">
              <LogoCard title="Original" data={original} />
              <LogoCard title="Processed" data={enhanced} />
            </div>
          </div>

          {/* RIGHT */}
          <div>
            <Typography variant="h5" className="mb-1">
              Preview
            </Typography>
            <div className="bg-white p-8 rounded-lg">
              {signatureHtml ? (
                <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
              ) : (
                <Typography variant="bodySm" className="opacity-80">
                  Generate the signature to see the preview.
                </Typography>
              )}
            </div>

            {signatureHtml && (
              <Button variant="outlined" onClick={() => copyHtml(signatureHtml)} className="mt-4">
                Copy Signature
              </Button>
            )}
          </div>
        </div>
    </>
  );
}

function LogoCard({ title, data }: { title: string; data: UploadResult | null }) {
  return (
    <Card variant="outlined" padding="sm" rounded="lg">
      <Typography variant="h6" className="mb-1">
        {title}
      </Typography>
      {data?.secure_url ? (
        <div className="flex flex-col gap-2">
          <div className="relative w-full aspect-[2/1] overflow-hidden rounded-md">
            <img src={data.secure_url} alt={title} className="absolute inset-0 h-full w-full object-contain" />
          </div>
          <Typography variant="caption" className="opacity-80">
            {data.width}×{data.height} • {Math.round((data.bytes ?? 0) / 1024)} KB • {data.format}
          </Typography>
        </div>
      ) : (
        <Typography variant="caption" className="opacity-70">
          No image
        </Typography>
      )}
    </Card>
  );
}
