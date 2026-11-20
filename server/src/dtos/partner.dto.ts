import { createZodDto } from '@immich/nestjs-standard-schema/zod';
import z from 'zod';
import { UserResponseSchema } from 'src/dtos/user.dto.js';
import { PartnerDirectionSchema } from 'src/enum.js';

const PartnerResponseSchema = UserResponseSchema.extend({
  inTimeline: z.boolean().optional().describe('Show in timeline'),
})
  .describe('Partner response')
  .meta({ id: 'PartnerResponseDto' });

export class PartnerCreateDto extends createZodDto({
  sharedWithId: z.uuidv4().describe('User ID to share with'),
}) {}

export class PartnerUpdateDto extends createZodDto({
  inTimeline: z.boolean().describe('Show partner assets in timeline'),
}) {}

export class PartnerSearchDto extends createZodDto({
  direction: PartnerDirectionSchema,
}) {}

export class PartnerResponseDto extends createZodDto(PartnerResponseSchema) {}

export class PartnerLockedAssetsDto extends createZodDto({
  assetIds: z.array(z.uuidv4()).min(1).describe('Locked asset IDs'),
}) {}

export class PartnerLockedAssetsResponseDto extends createZodDto({
  assetIds: z.array(z.uuidv4()).describe('Locked asset IDs visible to the partner'),
}) {}
