import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AssetVisibility } from 'src/enum.js';
import { TimelineService } from 'src/services/timeline.service.js';
import { PartnerFactory } from 'test/factories/partner.factory.js';
import { authStub } from 'test/fixtures/auth.stub.js';
import { getForPartner } from 'test/mappers.js';
import { ServiceMocks, newTestService } from 'test/utils.js';

describe(TimelineService.name, () => {
  let sut: TimelineService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(TimelineService));
  });

  describe('getTimeBuckets', () => {
    it("should return buckets if userId and albumId aren't set", async () => {
      mocks.asset.getTimeBuckets.mockResolvedValue([{ timeBucket: 'bucket', count: 1 }]);

      await expect(sut.getTimeBuckets(authStub.admin, {})).resolves.toEqual(
        expect.arrayContaining([{ timeBucket: 'bucket', count: 1 }]),
      );
      expect(mocks.asset.getTimeBuckets).toHaveBeenCalledWith(
        {
          userIds: [authStub.admin.user.id],
        },
        authStub.admin,
      );
    });

    it('should pass bbox options to repository when all bbox fields are provided', async () => {
      mocks.asset.getTimeBuckets.mockResolvedValue([{ timeBucket: 'bucket', count: 1 }]);

      await sut.getTimeBuckets(authStub.admin, {
        bbox: {
          west: -70,
          south: -30,
          east: 120,
          north: 55,
        },
      });

      expect(mocks.asset.getTimeBuckets).toHaveBeenCalledWith(
        {
          userIds: [authStub.admin.user.id],
          bbox: { west: -70, south: -30, east: 120, north: 55 },
        },
        authStub.admin,
      );
    });
  });

  describe('getTimeBucket', () => {
    it('should return the assets for a album time bucket if user has album.read', async () => {
      mocks.access.album.checkOwnerAccess.mockResolvedValue(new Set(['album-id']));
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });

      await expect(sut.getTimeBucket(authStub.admin, { timeBucket: 'bucket', albumId: 'album-id' })).resolves.toEqual(
        json,
      );

      expect(mocks.access.album.checkOwnerAccess).toHaveBeenCalledWith(
        authStub.admin.user.id,
        new Set(['album-id']),
        false,
      );
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        {
          timeBucket: 'bucket',
          albumId: 'album-id',
        },
        authStub.admin,
      );
    });

    it('should return the assets for a archive time bucket if user has archive.read', async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Archive,
          userId: authStub.admin.user.id,
        }),
      ).resolves.toEqual(json);
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        expect.objectContaining({
          timeBucket: 'bucket',
          visibility: AssetVisibility.Archive,
          userIds: [authStub.admin.user.id],
        }),
        authStub.admin,
      );
    });

    it('should include partner shared assets', async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });
      mocks.partner.getAll.mockResolvedValue([]);

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Timeline,
          userId: authStub.admin.user.id,
          withPartners: true,
        }),
      ).resolves.toEqual(json);
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Timeline,
          withPartners: true,
          userIds: [authStub.admin.user.id],
        },
        authStub.admin,
      );
    });

    it('should check permissions to read tag', async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });
      mocks.access.tag.checkOwnerAccess.mockResolvedValue(new Set(['tag-123']));

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          userId: authStub.admin.user.id,
          tagId: 'tag-123',
        }),
      ).resolves.toEqual(json);
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        {
          tagId: 'tag-123',
          timeBucket: 'bucket',
          userIds: [authStub.admin.user.id],
        },
        authStub.admin,
      );
    });

    it('should return the assets for a library time bucket if user has library.read', async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          userId: authStub.admin.user.id,
        }),
      ).resolves.toEqual(json);
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        expect.objectContaining({
          timeBucket: 'bucket',
          userIds: [authStub.admin.user.id],
        }),
        authStub.admin,
      );
    });

    it('should throw an error if withParners is true and visibility is archive or hidden', async () => {
      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Archive,
          withPartners: true,
          userId: authStub.admin.user.id,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Hidden,
          withPartners: true,
          userId: authStub.admin.user.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should default to timeline visibility if withPartners is true and visibility is undefined', async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });
      mocks.partner.getAll.mockResolvedValue([]);

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          withPartners: true,
          userId: authStub.admin.user.id,
        }),
      ).resolves.toEqual(json);
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        expect.objectContaining({ visibility: AssetVisibility.Timeline, userIds: [authStub.admin.user.id] }),
        authStub.admin,
      );
    });

    it("should default to timeline visibility for another user's timeline", async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });
      mocks.access.timeline.checkPartnerAccess.mockResolvedValue(new Set(['partner-id']));

      await expect(sut.getTimeBucket(authStub.admin, { timeBucket: 'bucket', userId: 'partner-id' })).resolves.toEqual(
        json,
      );
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        { timeBucket: 'bucket', visibility: AssetVisibility.Timeline, userIds: ['partner-id'] },
        authStub.admin,
      );
    });

    it("should throw an error for another user's archived, hidden, trashed or favorite assets", async () => {
      mocks.access.timeline.checkPartnerAccess.mockResolvedValue(new Set(['partner-id']));

      for (const dto of [
        { visibility: AssetVisibility.Archive },
        { visibility: AssetVisibility.Hidden },
        { isTrashed: true },
        { isFavorite: true },
        { isFavorite: false },
      ]) {
        await expect(
          sut.getTimeBucket(authStub.adminWithElevatedPermission, {
            timeBucket: 'bucket',
            userId: 'partner-id',
            ...dto,
          }),
        ).rejects.toThrow(BadRequestException);
      }

      expect(mocks.asset.getTimeBucket).not.toHaveBeenCalled();
    });

    it("should allow another user's locked assets with an elevated session", async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });
      mocks.access.timeline.checkPartnerAccess.mockResolvedValue(new Set(['partner-id']));

      await expect(
        sut.getTimeBucket(authStub.adminWithElevatedPermission, {
          timeBucket: 'bucket',
          userId: 'partner-id',
          visibility: AssetVisibility.Locked,
        }),
      ).resolves.toEqual(json);
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        { timeBucket: 'bucket', visibility: AssetVisibility.Locked, userIds: ['partner-id'] },
        authStub.adminWithElevatedPermission,
      );
    });

    it('should allow locked assets of an album through a shared link', async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });
      mocks.access.album.checkSharedLinkAccess.mockResolvedValue(new Set(['album-id']));

      await expect(
        sut.getTimeBucket(authStub.adminSharedLink, {
          timeBucket: 'bucket',
          albumId: 'album-id',
          visibility: AssetVisibility.Locked,
        }),
      ).resolves.toEqual(json);
    });

    it('should reject locked assets through a shared link without an album', async () => {
      await expect(
        sut.getTimeBucket(authStub.adminSharedLink, { timeBucket: 'bucket', visibility: AssetVisibility.Locked }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mocks.asset.getTimeBucket).not.toHaveBeenCalled();
    });

    it("should reject another user's locked assets without an elevated session", async () => {
      mocks.access.timeline.checkPartnerAccess.mockResolvedValue(new Set(['partner-id']));

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          userId: 'partner-id',
          visibility: AssetVisibility.Locked,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mocks.asset.getTimeBucket).not.toHaveBeenCalled();
    });

    it('should throw an error if withParners is true and isFavorite is either true or false', async () => {
      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          isFavorite: true,
          withPartners: true,
          userId: authStub.admin.user.id,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          isFavorite: false,
          withPartners: true,
          userId: authStub.admin.user.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require an elevated session for trashed assets', async () => {
      await expect(sut.getTimeBuckets(authStub.admin, { isTrashed: true })).rejects.toThrow(UnauthorizedException);
      await expect(sut.getTimeBucket(authStub.admin, { timeBucket: 'bucket', isTrashed: true })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mocks.asset.getTimeBuckets).not.toHaveBeenCalled();
      expect(mocks.asset.getTimeBucket).not.toHaveBeenCalled();
    });

    it('should return trashed assets to an elevated session', async () => {
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });

      await expect(
        sut.getTimeBucket(authStub.adminWithElevatedPermission, { timeBucket: 'bucket', isTrashed: true }),
      ).resolves.toEqual(json);
    });

    it('should throw an error if withParners is true and isTrash is true', async () => {
      await expect(
        sut.getTimeBucket(authStub.adminWithElevatedPermission, {
          timeBucket: 'bucket',
          isTrashed: true,
          withPartners: true,
          userId: authStub.admin.user.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include partners regardless of timeline setting if withPartners is true and visibility is locked', async () => {
      const auth = authStub.adminWithElevatedPermission;
      const partner = PartnerFactory.create({ sharedWithId: auth.user.id, inTimeline: false });
      const json = `[{ id: ['asset-id'] }]`;
      mocks.asset.getTimeBucket.mockResolvedValue({ assets: json });
      mocks.partner.getAll.mockResolvedValue([getForPartner(partner)]);

      await expect(
        sut.getTimeBucket(auth, {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Locked,
          withPartners: true,
          userId: auth.user.id,
        }),
      ).resolves.toEqual(json);
      expect(mocks.asset.getTimeBucket).toHaveBeenCalledWith(
        'bucket',
        {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Locked,
          withPartners: true,
          userIds: [auth.user.id, partner.sharedById],
        },
        auth,
      );
    });

    it('should reject withPartners and locked visibility without an elevated session', async () => {
      await expect(
        sut.getTimeBucket(authStub.admin, {
          timeBucket: 'bucket',
          visibility: AssetVisibility.Locked,
          withPartners: true,
          userId: authStub.admin.user.id,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mocks.asset.getTimeBucket).not.toHaveBeenCalled();
    });
  });
});
