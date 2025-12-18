import mongoose, { Document, Model } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new mongoose.Schema<ITenant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Tenant: Model<ITenant> = mongoose.model<ITenant>('Tenant', tenantSchema);

export default Tenant;

