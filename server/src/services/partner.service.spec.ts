import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AssetVisibility, SharingDirection } from 'src/enum.js';
import { Resource } from 'src/resource-paths.js';
import { PartnerService } from 'src/services/partner.service.js';
import { AssetFactory } from 'test/factories/asset.factory.js';
import { AuthFactory } from 'test/factories/auth.factory.js';
import { PartnerFactory } from 'test/factories/partner.factory.js';
import { UserFactory } from 'test/factories/user.factory.js';
import { getForAsset, getForPartner } from 'test/mappers.js';
import { ServiceMocks, expectResourceEvents, newTestService } from 'test/utils.js';

const setupLockedAssets = () => {
  const [user1, user2] = [UserFactory.create(), UserFactory.create()];
  const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
  const auth = AuthFactory.from(user1).session({ hasElevatedPermission: true }).build();
  return { user1, user2, partner, auth, partnerId: { sharedById: user1.id, sharedWithId: user2.id } };
};

describe(PartnerService.name, () => {
  let sut: PartnerService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PartnerService));
  });

  it('should work', () => {
    expect(sut).toBeDefined();
  });

  describe('search', () => {
    it("should return a list of partners with whom I've shared my library", async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const sharedWithUser2 = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const sharedWithUser1 = PartnerFactory.from().sharedBy(user2).sharedWith(user1).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.partner.getAll.mockResolvedValue([getForPartner(sharedWithUser1), getForPartner(sharedWithUser2)]);

      await expect(sut.search(auth, { direction: SharingDirection.SharedBy })).resolves.toBeDefined();
      expect(mocks.partner.getAll).toHaveBeenCalledWith(user1.id);
    });

    it('should return a list of partners who have shared their libraries with me', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const sharedWithUser2 = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const sharedWithUser1 = PartnerFactory.from().sharedBy(user2).sharedWith(user1).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.partner.getAll.mockResolvedValue([getForPartner(sharedWithUser1), getForPartner(sharedWithUser2)]);
      await expect(sut.search(auth, { direction: SharingDirection.SharedWith })).resolves.toBeDefined();
      expect(mocks.partner.getAll).toHaveBeenCalledWith(user1.id);
    });
  });

  describe('create', () => {
    it('should create a new partner', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.partner.get.mockResolvedValue(void 0);
      mocks.user.get.mockResolvedValue(user2);
      mocks.partner.create.mockResolvedValue(getForPartner(partner));

      await expect(sut.create(auth, { sharedWithId: user2.id })).resolves.toBeDefined();

      expect(mocks.partner.create).toHaveBeenCalledWith({
        sharedById: partner.sharedById,
        sharedWithId: partner.sharedWithId,
      });
    });

    it('should tell both partners and refresh the map of the shared with user', async () => {
      const [user1, user2] = [UserFactory.create(), UserFactory.create()];
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      mocks.partner.get.mockResolvedValue(void 0);
      mocks.user.get.mockResolvedValue(user2);
      mocks.partner.create.mockResolvedValue(getForPartner(partner));

      await sut.create(AuthFactory.create(user1), { sharedWithId: user2.id });

      expectResourceEvents(
        mocks,
        { userIds: [user1.id, user2.id], changed: [Resource.partners()] },
        { userIds: [user2.id], changed: [Resource.mapMarkers()] },
      );
    });

    it('should throw an error when the partner already exists', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.partner.get.mockResolvedValue(getForPartner(partner));

      await expect(sut.create(auth, { sharedWithId: user2.id })).rejects.toBeInstanceOf(BadRequestException);

      expect(mocks.partner.create).not.toHaveBeenCalled();
      expect(mocks.resource.send).not.toHaveBeenCalled();
    });

    it('should throw an error when sharedWithId does not resolve to an existing (non-deleted) user', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.partner.get.mockResolvedValue(void 0);
      mocks.user.get.mockResolvedValue(void 0);

      await expect(sut.create(auth, { sharedWithId: user2.id })).rejects.toBeInstanceOf(BadRequestException);

      expect(mocks.partner.create).not.toHaveBeenCalled();
      expect(mocks.resource.send).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a partner', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.partner.get.mockResolvedValue(getForPartner(partner));

      await sut.remove(auth, user2.id);

      expect(mocks.partner.remove).toHaveBeenCalledWith({ sharedById: user1.id, sharedWithId: user2.id });
      expect(mocks.partner.removeLockedAssets).toHaveBeenCalledWith({ sharedById: user1.id, sharedWithId: user2.id });
    });

    it('should tell both partners and refresh the map of the shared with user', async () => {
      const [user1, user2] = [UserFactory.create(), UserFactory.create()];
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      mocks.partner.get.mockResolvedValue(getForPartner(partner));

      await sut.remove(AuthFactory.create(user1), user2.id);

      expectResourceEvents(
        mocks,
        { userIds: [user1.id], changed: [Resource.partners()] },
        { userIds: [user2.id], changed: [Resource.partners(), Resource.mapMarkers()] },
      );
    });

    it('should throw an error when the partner does not exist', async () => {
      const user2 = UserFactory.create();
      const auth = AuthFactory.create();

      mocks.partner.get.mockResolvedValue(void 0);

      await expect(sut.remove(auth, user2.id)).rejects.toBeInstanceOf(BadRequestException);

      expect(mocks.partner.remove).not.toHaveBeenCalled();
      expect(mocks.resource.send).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should require access', async () => {
      const user2 = UserFactory.create();
      const auth = AuthFactory.create();

      await expect(sut.update(auth, user2.id, { inTimeline: false })).rejects.toBeInstanceOf(BadRequestException);

      expect(mocks.resource.send).not.toHaveBeenCalled();
    });

    it('should tell both partners', async () => {
      const [user1, user2] = [UserFactory.create(), UserFactory.create()];
      const partner = PartnerFactory.from().sharedBy(user2).sharedWith(user1).build();
      mocks.access.partner.checkUpdateAccess.mockResolvedValue(new Set([user2.id]));
      mocks.partner.update.mockResolvedValue(getForPartner(partner));

      await sut.update(AuthFactory.create(user1), user2.id, { inTimeline: false });

      expectResourceEvents(
        mocks,
        { userIds: [user1.id], changed: [Resource.partners()] },
        { userIds: [user2.id], changed: [Resource.partners()] },
      );
    });

    it('should update partner', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.access.partner.checkUpdateAccess.mockResolvedValue(new Set([user2.id]));
      mocks.partner.update.mockResolvedValue(getForPartner(partner));

      await expect(sut.update(auth, user2.id, { inTimeline: true })).resolves.toBeDefined();
      expect(mocks.partner.update).toHaveBeenCalledWith(
        { sharedById: user2.id, sharedWithId: user1.id },
        { inTimeline: true },
      );
    });
  });
  describe('locked assets', () => {
    describe('getLockedAssets', () => {
      it('should require an elevated session', async () => {
        const { user1, user2 } = setupLockedAssets();

        await expect(sut.getLockedAssets(AuthFactory.create(user1), user2.id)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );

        expect(mocks.partner.getLockedAssetIds).not.toHaveBeenCalled();
      });

      it('should require an existing partner', async () => {
        const { auth, user2 } = setupLockedAssets();
        mocks.partner.get.mockResolvedValue(void 0);

        await expect(sut.getLockedAssets(auth, user2.id)).rejects.toBeInstanceOf(BadRequestException);

        expect(mocks.partner.getLockedAssetIds).not.toHaveBeenCalled();
      });

      it('should return the granted asset ids', async () => {
        const { auth, user2, partner, partnerId } = setupLockedAssets();
        mocks.partner.get.mockResolvedValue(getForPartner(partner));
        mocks.partner.getLockedAssetIds.mockResolvedValue(['asset-1']);

        await expect(sut.getLockedAssets(auth, user2.id)).resolves.toEqual({ assetIds: ['asset-1'] });

        expect(mocks.partner.get).toHaveBeenCalledWith(partnerId);
        expect(mocks.partner.getLockedAssetIds).toHaveBeenCalledWith(partnerId);
      });
    });

    describe('addLockedAssets', () => {
      it('should require an elevated session', async () => {
        const { user1, user2 } = setupLockedAssets();

        await expect(
          sut.addLockedAssets(AuthFactory.create(user1), user2.id, { assetIds: ['asset-1'] }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(mocks.partner.addLockedAssets).not.toHaveBeenCalled();
      });

      it('should require an existing partner', async () => {
        const { auth, user2 } = setupLockedAssets();
        mocks.partner.get.mockResolvedValue(void 0);

        await expect(sut.addLockedAssets(auth, user2.id, { assetIds: ['asset-1'] })).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(mocks.partner.addLockedAssets).not.toHaveBeenCalled();
      });

      it('should require ownership of the assets', async () => {
        const { auth, user2, partner } = setupLockedAssets();
        mocks.partner.get.mockResolvedValue(getForPartner(partner));
        mocks.access.asset.checkOwnerAccess.mockResolvedValue(new Set());

        await expect(sut.addLockedAssets(auth, user2.id, { assetIds: ['asset-1'] })).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(mocks.access.asset.checkOwnerAccess).toHaveBeenCalledWith(auth.user.id, new Set(['asset-1']), true);
        expect(mocks.partner.addLockedAssets).not.toHaveBeenCalled();
      });

      it('should reject assets that are not locked', async () => {
        const { auth, user1, user2, partner } = setupLockedAssets();
        const lockedAsset = AssetFactory.create({ ownerId: user1.id, visibility: AssetVisibility.Locked });
        const timelineAsset = AssetFactory.create({ ownerId: user1.id, visibility: AssetVisibility.Timeline });
        mocks.partner.get.mockResolvedValue(getForPartner(partner));
        mocks.access.asset.checkOwnerAccess.mockResolvedValue(new Set([lockedAsset.id, timelineAsset.id]));
        mocks.asset.getByIds.mockResolvedValue([getForAsset(lockedAsset), getForAsset(timelineAsset)]);

        await expect(
          sut.addLockedAssets(auth, user2.id, { assetIds: [lockedAsset.id, timelineAsset.id] }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(mocks.partner.addLockedAssets).not.toHaveBeenCalled();
      });

      it('should grant locked assets to the partner', async () => {
        const { auth, user1, user2, partner, partnerId } = setupLockedAssets();
        const asset = AssetFactory.create({ ownerId: user1.id, visibility: AssetVisibility.Locked });
        mocks.partner.get.mockResolvedValue(getForPartner(partner));
        mocks.access.asset.checkOwnerAccess.mockResolvedValue(new Set([asset.id]));
        mocks.asset.getByIds.mockResolvedValue([getForAsset(asset)]);

        await sut.addLockedAssets(auth, user2.id, { assetIds: [asset.id] });

        expect(mocks.partner.addLockedAssets).toHaveBeenCalledWith(partnerId, [asset.id]);
        expectResourceEvents(mocks, { userIds: [user1.id, user2.id], changed: [Resource.partners()] });
      });
    });

    describe('removeLockedAssets', () => {
      it('should require an elevated session', async () => {
        const { user1, user2 } = setupLockedAssets();

        await expect(
          sut.removeLockedAssets(AuthFactory.create(user1), user2.id, { assetIds: ['asset-1'] }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(mocks.partner.removeLockedAssets).not.toHaveBeenCalled();
      });

      it('should require an existing partner', async () => {
        const { auth, user2 } = setupLockedAssets();
        mocks.partner.get.mockResolvedValue(void 0);

        await expect(sut.removeLockedAssets(auth, user2.id, { assetIds: ['asset-1'] })).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(mocks.partner.removeLockedAssets).not.toHaveBeenCalled();
      });

      it('should revoke locked assets from the partner', async () => {
        const { auth, user1, user2, partner, partnerId } = setupLockedAssets();
        mocks.partner.get.mockResolvedValue(getForPartner(partner));

        await sut.removeLockedAssets(auth, user2.id, { assetIds: ['asset-1'] });

        expect(mocks.partner.removeLockedAssets).toHaveBeenCalledWith(partnerId, ['asset-1']);
        expectResourceEvents(mocks, { userIds: [user1.id, user2.id], changed: [Resource.partners()] });
      });
    });
  });
});
