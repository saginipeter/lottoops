import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const uploadRouter = {
  invoiceUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  }).onUploadComplete(async ({ file }) => {
    return {
      url: file.ufsUrl,
    };
  }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;