import { BadRequestException, Injectable } from '@nestjs/common';
import { Partner } from 'src/database.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import {
  PartnerCreateDto,
  PartnerLockedAssetsDto,
  PartnerLockedAssetsResponseDto,
  PartnerResponseDto,
  PartnerSearchDto,
  PartnerUpdateDto,
} from 'src/dtos/partner.dto.js';
import { mapUser } from 'src/dtos/user.dto.js';
import { AssetVisibility, Permission, SharingDirection } from 'src/enum.js';
import { PartnerIds } from 'src/repositories/partner.repository.js';
import { Resource } from 'src/resource-paths.js';
import { BaseService } from 'src/services/base.service.js';
import { requireElevatedPermission } from 'src/utils/access.js';

@Injectable()
export class PartnerService extends BaseService {
  async create(auth: AuthDto, { sharedWithId }: PartnerCreateDto): Promise<PartnerResponseDto> {
    const partnerId: PartnerIds = { sharedById: auth.user.id, sharedWithId };
    const exists = await this.partnerRepository.get(partnerId);
    if (exists) {
      throw new BadRequestException(`Partner already exists`);
    }

    const user = await this.userRepository.get(sharedWithId, {});
    if (!user) {
      this.logger.debug('Partner creation failed: user not found');
      throw new BadRequestException('Invalid user');
    }

    const partner = await this.partnerRepository.create(partnerId);
    this.resourceRepository.send({ userIds: [auth.user.id, sharedWithId], changed: [Resource.partners()] });
    this.resourceRepository.send({ userIds: [sharedWithId], changed: [Resource.mapMarkers()] });
    return this.mapPartner(partner, SharingDirection.SharedBy);
  }

  async remove(auth: AuthDto, sharedWithId: string): Promise<void> {
    const partnerId: PartnerIds = { sharedById: auth.user.id, sharedWithId };
    const partner = await this.partnerRepository.get(partnerId);
    if (!partner) {
      throw new BadRequestException('Partner not found');
    }

    await this.partnerRepository.removeLockedAssets(partnerId);
    await this.partnerRepository.remove(partnerId);
    this.resourceRepository.send({ userIds: [auth.user.id], changed: [Resource.partners()] });
    this.resourceRepository.send({ userIds: [sharedWithId], changed: [Resource.partners(), Resource.mapMarkers()] });
  }

  async search(auth: AuthDto, { direction }: PartnerSearchDto): Promise<PartnerResponseDto[]> {
    const partners = await this.partnerRepository.getAll(auth.user.id);
    const key = direction === SharingDirection.SharedBy ? 'sharedById' : 'sharedWithId';
    return partners
      .filter((partner): partner is Partner => !!(partner.sharedBy && partner.sharedWith)) // Filter out soft deleted users
      .filter((partner) => partner[key] === auth.user.id)
      .map((partner) => this.mapPartner(partner, direction));
  }

  async update(auth: AuthDto, sharedById: string, dto: PartnerUpdateDto): Promise<PartnerResponseDto> {
    await this.requireAccess({ auth, permission: Permission.PartnerUpdate, ids: [sharedById] });
    const partnerId: PartnerIds = { sharedById, sharedWithId: auth.user.id };

    const entity = await this.partnerRepository.update(partnerId, { inTimeline: dto.inTimeline });
    this.resourceRepository.send({ userIds: [auth.user.id], changed: [Resource.partners()] });
    this.resourceRepository.send({ userIds: [sharedById], changed: [Resource.partners()] });
    return this.mapPartner(entity, SharingDirection.SharedWith);
  }

  async getLockedAssets(auth: AuthDto, sharedWithId: string): Promise<PartnerLockedAssetsResponseDto> {
    requireElevatedPermission(auth);
    const partnerId = await this.getOwnPartnerOrFail(auth, sharedWithId);
    return { assetIds: await this.partnerRepository.getLockedAssetIds(partnerId) };
  }

  async addLockedAssets(auth: AuthDto, sharedWithId: string, dto: PartnerLockedAssetsDto): Promise<void> {
    requireElevatedPermission(auth);
    const partnerId = await this.getOwnPartnerOrFail(auth, sharedWithId);
    await this.requireAccess({ auth, permission: Permission.AssetUpdate, ids: dto.assetIds });

    const assets = await this.assetRepository.getByIds(dto.assetIds);
    if (assets.some((asset) => asset.visibility !== AssetVisibility.Locked)) {
      throw new BadRequestException('Only locked assets can be shared with a partner');
    }

    await this.partnerRepository.addLockedAssets(partnerId, dto.assetIds);
    this.resourceRepository.send({ userIds: [auth.user.id, sharedWithId], changed: [Resource.partners()] });
  }

  async removeLockedAssets(auth: AuthDto, sharedWithId: string, dto: PartnerLockedAssetsDto): Promise<void> {
    requireElevatedPermission(auth);
    const partnerId = await this.getOwnPartnerOrFail(auth, sharedWithId);
    await this.partnerRepository.removeLockedAssets(partnerId, dto.assetIds);
    this.resourceRepository.send({ userIds: [auth.user.id, sharedWithId], changed: [Resource.partners()] });
  }

  private async getOwnPartnerOrFail(auth: AuthDto, sharedWithId: string): Promise<PartnerIds> {
    const partnerId: PartnerIds = { sharedById: auth.user.id, sharedWithId };
    const partner = await this.partnerRepository.get(partnerId);
    if (!partner) {
      throw new BadRequestException('Partner not found');
    }
    return partnerId;
  }

  private mapPartner(partner: Partner, direction: SharingDirection): PartnerResponseDto {
    // this is opposite to return the non-me user of the "partner"
    const sharedUser = direction === SharingDirection.SharedBy ? partner.sharedWith : partner.sharedBy;
    const user = mapUser(sharedUser);

    return { ...user, inTimeline: partner.inTimeline };
  }
}
