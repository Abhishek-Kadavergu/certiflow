
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import multer from "multer";
import { parse } from "csv-parse/sync";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
});

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("TRAINING_CENTER"),
  async (req, res) => {
    try {
      const { batchNumber, courseName, district, candidates } = req.body;

      if (!batchNumber || !courseName || !district || !Array.isArray(candidates)) {
        return res.status(400).json({
          message: "Batch details and candidates array are required",
        });
      }

      if (candidates.length === 0) {
        return res.status(400).json({
          message: "At least one candidate is required",
        });
      }

      // Basic candidate validation
      const invalidCandidate = candidates.find(
        (c) => !c.candidateId || !c.fullName || !c.phone
      );

      if (invalidCandidate) {
        return res.status(400).json({
          message: "Every candidate must have candidateId, fullName and phone",
        });
      }

      const batch = await prisma.batch.create({
        data: {
          batchNumber,
          courseName,
          district,
          centerId: req.user!.userId,
          candidates: {
            create: candidates.map((candidate) => ({
              candidateId: candidate.candidateId,
              fullName: candidate.fullName,
              phone: candidate.phone,
              email: candidate.email || null,
            })),
          },
        },
        include: {
          candidates: true,
        },
      });

      return res.status(201).json({
        message: "Batch created successfully",
        batch,
      });
    } catch (error: any) {
      console.error(error);

      if (error.code === "P2002") {
        return res.status(409).json({
          message: "Batch number already exists",
        });
      }

      return res.status(500).json({
        message: "Failed to create batch",
      });
    }
  }
);


router.patch(
  "/:id/submit",
  authenticate,
  authorize("TRAINING_CENTER"),
  async (req, res) => {
    try {
      const batchId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const batch = await prisma.batch.findFirst({
        where: {
          id: batchId,
          centerId: req.user!.userId,
        },
        include: {
          candidates: true,
        },
      });

      if (!batch) {
        return res.status(404).json({
          message: "Batch not found",
        });
      }

      if (!["DRAFT", "RETURNED"].includes(batch.status)) {
        return res.status(400).json({
          message: "This batch cannot be submitted in its current state",
        });
      }

      if (batch.candidates.length === 0) {
        return res.status(400).json({
          message: "Cannot submit an empty batch",
        });
      }

      const nextCycle =
        batch.status === "RETURNED"
          ? batch.reviewCycle + 1
          : batch.reviewCycle;

      const result = await prisma.batch.updateMany({
        where: {
          id: batch.id,
          status: batch.status,
        },
        data: {
          status: "DISTRICT_REVIEW",
          submittedAt: new Date(),
          reviewCycle: nextCycle,
        },
      });

      if (result.count === 0) {
        return res.status(409).json({
          message: "Batch was modified. Please try again.",
        });
      }

      const updatedBatch = await prisma.batch.findUnique({
        where: { id: batch.id },
        include: { candidates: true },
      });

      return res.status(200).json({
        message: "Batch submitted successfully",
        batch: updatedBatch,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to submit batch",
      });
    }
  }
);


router.get(
  "/pending",
  authenticate,
  authorize("DISTRICT_OFFICER"),
  async (req, res) => {
    try {
      const officer = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!officer?.district) {
        return res.status(400).json({
          message: "Officer district is not configured",
        });
      }

      const batches = await prisma.batch.findMany({
        where: {
          status: "DISTRICT_REVIEW",
          district: officer.district,
        },
        include: {
          candidates: true,
          approvals: {
            where: {
              stage: "DISTRICT",
            },
          },
          center: {
            select: { name: true, email: true },
          },
        },
        orderBy: { submittedAt: "asc" },
      });

      const available = batches.filter(
        (batch) =>
          !batch.approvals.some(
            (approval) =>
              approval.reviewerId === officer.id &&
              approval.reviewCycle === batch.reviewCycle
          )
      );

      return res.json(available);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Failed to fetch pending batches",
      });
    }
  }
);


router.post(
  "/:id/review",
  authenticate,
  authorize("DISTRICT_OFFICER"),
  async (req, res) => {
    try {
      const { decision, comment } = req.body;
      const batchId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      if (!["APPROVED", "RETURNED", "REJECTED"].includes(decision)) {
        return res.status(400).json({
          message: "Invalid decision",
        });
      }

      if (decision !== "APPROVED" && (!comment || !comment.trim())) {
        return res.status(400).json({
          message: "A comment is required for return or rejection",
        });
      }

      const officer = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!officer?.district) {
        return res.status(400).json({
          message: "Officer district is not configured",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const batch = await tx.batch.findFirst({
          where: {
            id: batchId,
            district: officer.district!,
            status: "DISTRICT_REVIEW",
          },
          include: {
            candidates: true,
          },
        });

        if (!batch) {
          throw new Error("BATCH_NOT_AVAILABLE");
        }

        const existing = await tx.approval.findFirst({
          where: {
            batchId,
            reviewerId: officer.id,
            stage: "DISTRICT",
            reviewCycle: batch.reviewCycle,
          },
        });

        if (existing) {
          throw new Error("ALREADY_REVIEWED");
        }

        await tx.approval.create({
          data: {
            batchId,
            reviewerId: officer.id,
            stage: "DISTRICT",
            decision,
            comment: comment || null,
            reviewCycle: batch.reviewCycle,
          },
        });

        if (decision === "RETURNED" || decision === "REJECTED") {
          await tx.batch.update({
            where: { id: batchId },
            data: {
              status: decision === "RETURNED" ? "RETURNED" : "REJECTED",
            },
          });

          return {
            status: decision === "RETURNED" ? "RETURNED" : "REJECTED",
            approvalsRequired: 2,
            approvalsReceived: 0,
          };
        }

        const approvalsReceived = await tx.approval.count({
          where: {
            batchId,
            stage: "DISTRICT",
            decision: "APPROVED",
            reviewCycle: batch.reviewCycle,
          },
        });

        if (approvalsReceived >= 2) {
          await tx.batch.update({
            where: { id: batchId },
            data: { status: "STATE_REVIEW" },
          });

          return {
            status: "STATE_REVIEW",
            approvalsRequired: 2,
            approvalsReceived,
          };
        }

        return {
          status: "DISTRICT_REVIEW",
          approvalsRequired: 2,
          approvalsReceived,
        };
      });

      return res.json({
        message: "Review submitted successfully",
        ...result,
      });
        } catch (error: any) {
        if (error.message === "BATCH_NOT_AVAILABLE") {
            return res.status(404).json({
            message: "Batch not available for your district",
            });
        }

        if (error.message === "ALREADY_REVIEWED") {
            return res.status(409).json({
            message: "You have already reviewed this batch",
            });
        }

        if (error.code === "P2002") {
            return res.status(409).json({
            message: "You have already reviewed this batch",
            });
        }

        console.error("DISTRICT REVIEW ERROR:", error);

        return res.status(500).json({
            message: "Review failed",
            error: error.message,
            code: error.code || null,
        });
        }
  }
);

router.get(
  "/state-pending",
  authenticate,
  authorize("STATE_ADMIN"),
  async (req, res) => {
    try {
      const batches = await prisma.batch.findMany({
        where: {
          status: "STATE_REVIEW",
        },
        include: {
          candidates: true,
          center: {
            select: {
              name: true,
              email: true,
            },
          },
          approvals: {
            where: {
              stage: "DISTRICT",
              decision: "APPROVED",
            },
            include: {
              reviewer: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          submittedAt: "asc",
        },
      });

      return res.json(batches);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Failed to fetch state pending batches",
      });
    }
  }
);

router.post(
  "/:id/state-approve",
  authenticate,
  authorize("STATE_ADMIN"),
  async (req, res) => {
    try {
      const batchId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const result = await prisma.$transaction(async (tx) => {
        const batch = await tx.batch.findUnique({
            where: { id: batchId },
            include: {
                candidates: true,
            },
        });
        if (!batch || batch.status !== "STATE_REVIEW") {
            throw new Error("BATCH_NOT_AVAILABLE");
        }

        const districtApprovals = await tx.approval.count({
          where: {
            batchId,
            stage: "DISTRICT",
            decision: "APPROVED",
            reviewCycle: batch.reviewCycle,
          },
        });

        if (districtApprovals < 2) {
          throw new Error("DISTRICT_APPROVALS_INCOMPLETE");
        }

        await tx.approval.create({
          data: {
            batchId,
            reviewerId: req.user!.userId,
            stage: "STATE",
            decision: "APPROVED",
            reviewCycle: batch.reviewCycle,
          },
        });

        await tx.certificate.createMany({
          data: batch.candidates.map((candidate) => ({
            certificateNumber: `CF-${batch.batchNumber}-${candidate.candidateId}`,
            candidateId: candidate.id,
          })),
          skipDuplicates: true,
        });

        const updated = await tx.batch.updateMany({
          where: {
            id: batchId,
            status: "STATE_REVIEW",
          },
          data: {
            status: "APPROVED",
          },
        });

        if (updated.count === 0) {
          throw new Error("BATCH_NOT_AVAILABLE");
        }

        const issuedCertificates = await tx.certificate.findMany({
          where: {
            candidateId: { in: batch.candidates.map((candidate) => candidate.id) },
          },
          include: { candidate: true },
        });

        await tx.delivery.createMany({
          data: issuedCertificates.map((certificate) => ({
            certificateId: certificate.id,
            phone: certificate.candidate.phone,
            status: "PENDING",
          })),
          skipDuplicates: true,
        });

        return {
          batchId,
          status: "APPROVED",
        };
      });

      return res.json({
        message: "Batch approved by State Admin",
        ...result,
      });
    } catch (error: any) {
      if (error.message === "BATCH_NOT_AVAILABLE") {
        return res.status(404).json({
          message: "Batch is not available for state approval",
        });
      }

      if (error.message === "DISTRICT_APPROVALS_INCOMPLETE") {
        return res.status(400).json({
          message: "Two district approvals are required",
        });
      }

      console.error(error);
      return res.status(500).json({
        message: "State approval failed",
      });
    }
  }
);

router.get(
  "/quality-pending",
  authenticate,
  authorize("QUALITY_REVIEWER"),
  async (req, res) => {
    try {
      const batches = await prisma.batch.findMany({
        where: {
          status: "QUALITY_REVIEW",
        },
        include: {
          center: {
            select: {
              name: true,
              email: true,
            },
          },
          candidates: true,
          approvals: {
            where: {
              stage: "DISTRICT",
              reviewCycle: {
                equals: 1,
              },
            },
            include: {
              reviewer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          submittedAt: "asc",
        },
      });

      return res.status(200).json(batches);
    } catch (error) {
      console.error("QUALITY PENDING ERROR:", error);

      return res.status(500).json({
        message: "Failed to fetch quality review batches",
      });
    }
  }
);

router.get(
  "/my-batches",
  authenticate,
  authorize("TRAINING_CENTER"),
  async (req, res) => {
    try {
      const batches = await prisma.batch.findMany({
        where: {
          centerId: req.user!.userId,
        },
        include: {
          candidates: {
            include: {
              certificate: {
                include: {
                  deliveries: true,
                },
              },
            },
          },
          approvals: {
            include: {
              reviewer: {
                select: {
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const result = batches.map((batch) => ({
        ...batch,
        candidateCount: batch.candidates.length,
        certificateCount: batch.candidates.filter(
          (candidate) => candidate.certificate !== null
        ).length,
      }));

      return res.status(200).json(result);
    } catch (error) {
      console.error("MY BATCHES ERROR:", error);

      return res.status(500).json({
        message: "Failed to fetch your batches",
      });
    }
  }
);

router.get(
  "/my-reviews",
  authenticate,
  authorize("DISTRICT_OFFICER"),
  async (req, res) => {
    try {
      const reviews = await prisma.approval.findMany({
        where: {
          reviewerId: req.user!.userId,
          stage: "DISTRICT",
        },
        include: {
          batch: {
            include: {
              center: {
                select: {
                  name: true,
                  email: true,
                },
              },
              candidates: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const result = reviews.map((review) => ({
        id: review.id,
        decision: review.decision,
        comment: review.comment,
        reviewCycle: review.reviewCycle,
        reviewedAt: review.createdAt,
        batch: {
          id: review.batch.id,
          batchNumber: review.batch.batchNumber,
          courseName: review.batch.courseName,
          district: review.batch.district,
          status: review.batch.status,
          candidateCount: review.batch.candidates.length,
          trainingCenter: review.batch.center.name,
        },
      }));

      return res.status(200).json(result);
    } catch (error) {
      console.error("MY REVIEWS ERROR:", error);

      return res.status(500).json({
        message: "Failed to fetch review history",
      });
    }
  }
);

router.post(
  "/upload-csv",
  authenticate,
  authorize("TRAINING_CENTER"),
  upload.single("file"),
  async (req, res) => {
    try {
      const { batchNumber, courseName, district } = req.body;

      // 1. Validate batch details
      if (!batchNumber || !courseName || !district) {
        return res.status(400).json({
          message: "batchNumber, courseName and district are required",
        });
      }

      // 2. Validate uploaded file
      if (!req.file) {
        return res.status(400).json({
          message: "CSV file is required",
        });
      }

      // 3. Parse CSV
      const records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      if (records.length === 0) {
        return res.status(400).json({
          message: "CSV contains no candidate records",
        });
      }

      // 4. Validate all rows before writing to database
      const errors: { row: number; message: string }[] = [];
      const candidateIds = new Set<string>();

      const candidates = records.map((record: any, index: number) => {
        const row = index + 2; // Header is row 1

        const candidateId = record.candidateId?.trim();
        const fullName = record.fullName?.trim();
        const phone = record.phone?.trim();
        const email = record.email?.trim() || null;

        if (!candidateId) {
          errors.push({
            row,
            message: "candidateId is required",
          });
        }

        if (!fullName) {
          errors.push({
            row,
            message: "fullName is required",
          });
        }

        if (!phone) {
          errors.push({
            row,
            message: "phone is required",
          });
        }

        if (candidateId && candidateIds.has(candidateId)) {
          errors.push({
            row,
            message: `Duplicate candidateId: ${candidateId}`,
          });
        }

        if (candidateId) {
          candidateIds.add(candidateId);
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({
            row,
            message: "Invalid email format",
          });
        }

        return {
          candidateId,
          fullName,
          phone,
          email,
        };
      });

      // 5. Reject the entire upload if any row is invalid
      if (errors.length > 0) {
        return res.status(400).json({
          message: "CSV validation failed. No data was saved.",
          errors,
        });
      }

      // 6. Create batch and candidates in a single transaction
      const batch = await prisma.$transaction(async (tx) =>
        tx.batch.create({
          data: {
            batchNumber,
            courseName,
            district,
            centerId: req.user!.userId,
            candidates: {
              create: candidates,
            },
          },
          include: {
            candidates: true,
          },
        })
      );

      return res.status(201).json({
        message: "Batch uploaded successfully",
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        candidateCount: batch.candidates.length,
      });
    } catch (error: any) {
      console.error("CSV UPLOAD ERROR:", error);

      if (error.code === "P2002") {
        return res.status(409).json({
          message: "Batch number or candidate data already exists",
        });
      }

      return res.status(500).json({
        message: "Failed to upload CSV batch",
      });
    }
  }
);

export default router;
