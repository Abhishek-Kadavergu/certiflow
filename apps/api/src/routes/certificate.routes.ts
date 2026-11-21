
import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { authorize } from "../middleware/role.middleware";

const router = Router();

async function sendCertificatePdf(certificate: any, res: Response) {
  const verificationUrl =
    `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/verify/${certificate.verificationToken}`;
  const qrImage = await QRCode.toDataURL(verificationUrl);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 40,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${certificate.certificateNumber}.pdf"`
  );

  doc.pipe(res);
  doc.lineWidth(4).strokeColor("#2563eb");
  doc.rect(30, 30, 782, 535).stroke();
  doc.fontSize(30).fillColor("#1e3a8a").text("CERTIFICATE OF COMPLETION", 0, 100, { align: "center" });
  doc.fontSize(16).fillColor("#333333").text("This certificate is proudly presented to", 0, 180, { align: "center" });
  doc.fontSize(28).fillColor("#000000").text(certificate.candidate.fullName, 0, 230, { align: "center" });
  doc.fontSize(16).text("for successfully completing", 0, 290, { align: "center" });
  doc.fontSize(22).fillColor("#2563eb").text(certificate.candidate.batch.courseName, 0, 330, { align: "center" });
  doc.fontSize(12).fillColor("#333333");
  doc.text(`Certificate No: ${certificate.certificateNumber}`, 80, 430);
  doc.text(`Issued on: ${certificate.issuedAt.toLocaleDateString()}`, 80, 455);
  if (certificate.candidate.batch.center?.name) {
    doc.text(`Issuing institution: ${certificate.candidate.batch.center.name}`, 80, 480);
  }
  doc.image(qrImage, 650, 410, { width: 100, height: 100 });
  doc.fontSize(10).text("Scan to verify", 650, 515, { width: 100, align: "center" });
  doc.end();
}

router.get(
  "/",
  authenticate,
  authorize("STATE_ADMIN"),
  async (_req, res) => {
    try {
      const certificates = await prisma.certificate.findMany({
        include: {
          candidate: {
            include: {
              batch: {
                select: {
                  id: true,
                  batchNumber: true,
                  courseName: true,
                  district: true,
                },
              },
            },
          },
          deliveries: true,
        },
        orderBy: { issuedAt: "desc" },
      });
      return res.json(certificates);
    } catch (error) {
      console.error("CERTIFICATE LIST ERROR:", error);
      return res.status(500).json({ message: "Failed to fetch certificates" });
    }
  }
);

router.get(
  "/verify/:token/pdf",
  async (req, res) => {
    try {
      const token = Array.isArray(req.params.token)
        ? req.params.token[0]
        : req.params.token;
      const certificate = await prisma.certificate.findUnique({
        where: { verificationToken: token },
        include: {
          candidate: {
            include: {
              batch: {
                include: {
                  center: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      await sendCertificatePdf(certificate, res);
    } catch (error) {
      console.error("PUBLIC PDF ERROR:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to generate certificate PDF" });
      }
    }
  }
);

router.get(
  "/:id/pdf",
  authenticate,
  async (req, res) => {
    try {
      const certificateId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const certificate = await prisma.certificate.findUnique({
        where: { id: certificateId },
        include: {
          candidate: {
            include: {
              batch: {
                include: {
                  center: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!certificate) {
        return res.status(404).json({
          message: "Certificate not found",
        });
      }

      const role = req.user!.role;
      const batchCenterId = certificate.candidate.batch.centerId;
      let districtAllowed = false;
      if (role === "DISTRICT_OFFICER") {
        const officer = await prisma.user.findUnique({
          where: { id: req.user!.userId },
          select: { district: true },
        });
        districtAllowed = officer?.district === certificate.candidate.batch.district;
      }
      if (
        role !== "STATE_ADMIN" &&
        !districtAllowed &&
        !(role === "TRAINING_CENTER" && batchCenterId === req.user!.userId)
      ) {
        return res.status(403).json({ message: "Forbidden: certificate access denied" });
      }

      const verificationUrl =
        `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/verify/${certificate.verificationToken}`;

      const qrImage = await QRCode.toDataURL(verificationUrl);

      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 40,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${certificate.certificateNumber}.pdf"`
      );

      doc.pipe(res);

      // Border
      doc.lineWidth(4).strokeColor("#2563eb");
      doc.rect(30, 30, 782, 535).stroke();

      // Certificate title
      doc
        .fontSize(30)
        .fillColor("#1e3a8a")
        .text("CERTIFICATE OF COMPLETION", 0, 100, {
          align: "center",
        });

      doc
        .fontSize(16)
        .fillColor("#333333")
        .text("This certificate is proudly presented to", 0, 180, {
          align: "center",
        });

      // Candidate name
      doc
        .fontSize(28)
        .fillColor("#000000")
        .text(certificate.candidate.fullName, 0, 230, {
          align: "center",
        });

      doc
        .fontSize(16)
        .text("for successfully completing", 0, 290, {
          align: "center",
        });

      doc
        .fontSize(22)
        .fillColor("#2563eb")
        .text(certificate.candidate.batch.courseName, 0, 330, {
          align: "center",
        });

      // Certificate details
      doc
        .fontSize(12)
        .fillColor("#333333")
        .text(`Certificate No: ${certificate.certificateNumber}`, 80, 430);

      doc.text(
        `Issued on: ${certificate.issuedAt.toLocaleDateString()}`,
        80,
        455
      );

      // QR code
      doc.image(qrImage, 650, 410, {
        width: 100,
        height: 100,
      });

      doc
        .fontSize(10)
        .text("Scan to verify", 650, 515, {
          width: 100,
          align: "center",
        });

      doc.end();
    } catch (error) {
      console.error("PDF GENERATION ERROR:", error);

      if (!res.headersSent) {
        return res.status(500).json({
          message: "Failed to generate certificate PDF",
        });
      }
    }
  }
);

router.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const certificate = await prisma.certificate.findUnique({
      where: {
        certificateNumber: token,
      },
      include: {
        candidate: {
          include: {
            batch: {
              include: {
                center: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!certificate) {
      return res.status(404).json({
        verified: false,
        message: "Certificate not found",
      });
    }

    const isRevoked = certificate.revokedAt !== null;

    return res.status(200).json({
      verified: !isRevoked,
      status: isRevoked ? "REVOKED" : "VALID",
      certificateNumber: certificate.certificateNumber,
      candidateName: certificate.candidate.fullName,
      courseName: certificate.candidate.batch.courseName,
      issuingInstitution: certificate.candidate.batch.center.name,
      issuedAt: certificate.issuedAt,
      revokedAt: certificate.revokedAt,
      revocationReason: certificate.revocationReason,
    });
  } catch (error) {
    console.error("VERIFICATION ERROR:", error);

    return res.status(500).json({
      message: "Failed to verify certificate",
    });
  }
});



router.post(
  "/:id/revoke",
  authenticate,
  authorize("STATE_ADMIN"),
  async (req, res) => {
    try {
      const certificateId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          message: "Revocation reason is required",
        });
      }

      const certificate = await prisma.certificate.findUnique({
        where: {
          id: certificateId,
        },
      });

      if (!certificate) {
        return res.status(404).json({
          message: "Certificate not found",
        });
      }

      if (certificate.revokedAt) {
        return res.status(400).json({
          message: "Certificate is already revoked",
        });
      }

      const updatedCertificate = await prisma.certificate.update({
        where: {
          id: certificateId,
        },
        data: {
          revokedAt: new Date(),
          revocationReason: reason.trim(),
        },
      });

      return res.status(200).json({
        message: "Certificate revoked successfully",
        certificateNumber: updatedCertificate.certificateNumber,
        status: "REVOKED",
        revokedAt: updatedCertificate.revokedAt,
        revocationReason: updatedCertificate.revocationReason,
      });
    } catch (error) {
      console.error("REVOCATION ERROR:", error);

      return res.status(500).json({
        message: "Failed to revoke certificate",
      });
    }
  }
);

export default router;
