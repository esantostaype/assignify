/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";

import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Button from "@mui/joy/Button";
import Alert from "@mui/joy/Alert";
import AspectRatio from "@mui/joy/AspectRatio";

type UploadResult = {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

const schema = Yup.object({
  fullName: Yup.string().trim().min(2).required("Nombre requerido"),
  title: Yup.string().trim().min(2).required("Cargo requerido"),
  phone: Yup.string().trim().min(6).required("Teléfono requerido"),
  email: Yup.string().trim().email("Email inválido").required("Email requerido"),
  address: Yup.string().trim().min(2).required("Dirección requerida"),
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
        if (!r.ok) throw new Error(json?.error || "No se pudo generar la firma");

        setSignatureHtml(json.html);
      } catch (e: any) {
        setErr(e?.message || "Error generando firma");
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

      // warning simple de baja calidad
      if ((json?.width ?? 0) < 300 || (json?.height ?? 0) < 300) {
        setErr("⚠️ El logo parece pequeño. La IA puede ayudar, pero lo ideal es subir un PNG grande o SVG.");
      }
    } catch (e: any) {
      setErr(e?.message || "Error subiendo imagen");
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
      setErr(e?.message || "Error mejorando logo");
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
        <Typography level="h2">Outlook Signature Generator</Typography>
        <Typography level="body-sm" sx={{ opacity: 0.8, mt: 0.5 }}>
          Formik + Yup + Joy UI. Subes tu logo, opcionalmente lo mejoras con IA, y generas HTML compatible.
        </Typography>

        <Divider sx={{ my: 2 }} />

        {err && (
          <Alert color="warning" variant="soft" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          {/* LEFT */}
          <Box>
            <form onSubmit={formik.handleSubmit}>
              <Stack spacing={1.5}>
                <FormControl error={Boolean(formik.touched.fullName && formik.errors.fullName)}>
                  <FormLabel>Nombre</FormLabel>
                  <Input name="fullName" value={formik.values.fullName} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.fullName && formik.errors.fullName && (
                    <Typography level="body-xs" color="danger">
                      {formik.errors.fullName}
                    </Typography>
                  )}
                </FormControl>

                <FormControl error={Boolean(formik.touched.title && formik.errors.title)}>
                  <FormLabel>Cargo</FormLabel>
                  <Input name="title" value={formik.values.title} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.title && formik.errors.title && (
                    <Typography level="body-xs" color="danger">
                      {formik.errors.title}
                    </Typography>
                  )}
                </FormControl>

                <FormControl error={Boolean(formik.touched.phone && formik.errors.phone)}>
                  <FormLabel>Teléfono</FormLabel>
                  <Input name="phone" value={formik.values.phone} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.phone && formik.errors.phone && (
                    <Typography level="body-xs" color="danger">
                      {formik.errors.phone}
                    </Typography>
                  )}
                </FormControl>

                <FormControl error={Boolean(formik.touched.email && formik.errors.email)}>
                  <FormLabel>Email</FormLabel>
                  <Input name="email" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.email && formik.errors.email && (
                    <Typography level="body-xs" color="danger">
                      {formik.errors.email}
                    </Typography>
                  )}
                </FormControl>

                <FormControl error={Boolean(formik.touched.address && formik.errors.address)}>
                  <FormLabel>Dirección</FormLabel>
                  <Input name="address" value={formik.values.address} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.address && formik.errors.address && (
                    <Typography level="body-xs" color="danger">
                      {formik.errors.address}
                    </Typography>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Otros</FormLabel>
                  <Textarea
                    name="extra"
                    minRows={3}
                    value={formik.values.extra}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </FormControl>

                <Divider sx={{ my: 1 }} />

                <FormControl>
                  <FormLabel>Logo personalizado (usuario)</FormLabel>
                  <Input
                    type="file"
                    slotProps={{ input: { accept: "image/*" } }}
                    onChange={(e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleUpload(f);
                    }}
                    disabled={busyUpload}
                  />
                </FormControl>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="soft"
                    onClick={handleEnhance}
                    disabled={!original?.secure_url || busyEnhance}
                  >
                    {busyEnhance ? "Mejorando..." : "Mejorar con IA"}
                  </Button>

                  <Button type="submit" disabled={!formik.isValid || busyGenerate}>
                    {busyGenerate ? "Generando..." : "Generar firma"}
                  </Button>
                </Stack>
              </Stack>
            </form>

            <Divider sx={{ my: 2 }} />

            <Typography level="title-md" sx={{ mb: 1 }}>
              Logos
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <LogoCard title="Original" data={original} />
              <LogoCard title="Procesado" data={enhanced} />
            </Box>
          </Box>

          {/* RIGHT */}
          <Box>
            <Typography level="title-md" sx={{ mb: 1 }}>
              Preview
            </Typography>
            <div className="bg-white p-8 rounded-lg">
              {signatureHtml ? (
                <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
              ) : (
                <Typography level="body-sm" sx={{ opacity: 0.8 }}>
                  Genera la firma para ver el preview.
                </Typography>
              )}
            </div>

            {signatureHtml && (
              <Button variant="outlined" onClick={() => copyHtml(signatureHtml)}>
                Copy Signature
              </Button>
            )}
          </Box>
        </Box>
    </>
  );
}

function LogoCard({ title, data }: { title: string; data: UploadResult | null }) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 1.5 }}>
      <Typography level="title-sm" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {data?.secure_url ? (
        <Stack spacing={1}>
          <AspectRatio ratio="4/2">
            <img src={data.secure_url} alt={title} style={{ objectFit: "contain" }} />
          </AspectRatio>
          <Typography level="body-xs" sx={{ opacity: 0.8 }}>
            {data.width}×{data.height} • {Math.round((data.bytes ?? 0) / 1024)} KB • {data.format}
          </Typography>
        </Stack>
      ) : (
        <Typography level="body-xs" sx={{ opacity: 0.7 }}>
          Sin imagen
        </Typography>
      )}
    </Sheet>
  );
}