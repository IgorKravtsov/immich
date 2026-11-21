import { AlbumUserRole, AssetMediaResponseDto, AssetVisibility, LoginResponseDto, SharedLinkType } from '@immich/sdk';
import { createUserDto } from 'src/fixtures.js';
import { app, utils } from 'src/utils.js';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const ownerPin = '123456';
const recipientPin = '654321';

const unlock = (accessToken: string, pinCode: string) =>
  request(app).post('/auth/session/unlock').set('Authorization', `Bearer ${accessToken}`).send({ pinCode });

const setupPin = (accessToken: string, pinCode: string) =>
  request(app).post('/auth/pin-code').set('Authorization', `Bearer ${accessToken}`).send({ pinCode });

const getVisibility = async (accessToken: string, assetId: string) => {
  const { body } = await request(app).get(`/assets/${assetId}`).set('Authorization', `Bearer ${accessToken}`);
  return body.visibility as AssetVisibility;
};

describe('locked albums', () => {
  let admin: LoginResponseDto;
  let owner: LoginResponseDto;
  let recipient: LoginResponseDto;
  let ownerAssets: AssetMediaResponseDto[];
  let regularAlbumId: string;
  let lockedAlbumId: string;

  beforeAll(async () => {
    await utils.resetDatabase();
    admin = await utils.adminSetup();
    [owner, recipient] = await Promise.all([
      utils.userSetup(admin.accessToken, createUserDto.user1),
      utils.userSetup(admin.accessToken, createUserDto.user2),
    ]);

    ownerAssets = await Promise.all([
      utils.createAsset(owner.accessToken),
      utils.createAsset(owner.accessToken),
      utils.createAsset(owner.accessToken),
      utils.createAsset(owner.accessToken),
      utils.createAsset(owner.accessToken),
    ]);

    await setupPin(owner.accessToken, ownerPin);
    await setupPin(recipient.accessToken, recipientPin);

    const regular = await utils.createAlbum(owner.accessToken, {
      albumName: 'regular',
      assetIds: [ownerAssets[0].id, ownerAssets[1].id],
    });
    regularAlbumId = regular.id;
  });

  describe('POST /albums', () => {
    it('should require an elevated session to create a locked album', async () => {
      const { status } = await request(app)
        .post('/albums')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ albumName: 'locked', isLocked: true, assetIds: [ownerAssets[1].id] });

      expect(status).toBe(401);
    });

    it('should lock the assets of a new locked album and remove them from regular albums', async () => {
      await unlock(owner.accessToken, ownerPin);
      const { status, body } = await request(app)
        .post('/albums')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ albumName: 'locked', isLocked: true, assetIds: [ownerAssets[1].id] });

      expect(status).toBe(201);
      expect(body).toMatchObject({ isLocked: true, assetCount: 1 });
      lockedAlbumId = body.id;

      expect(await getVisibility(owner.accessToken, ownerAssets[1].id)).toBe(AssetVisibility.Locked);
      const { body: regular } = await request(app)
        .get(`/albums/${regularAlbumId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(regular.assetCount).toBe(1);
    });
  });

  describe('GET /albums', () => {
    it('should not return locked albums by default', async () => {
      const { body } = await request(app).get('/albums').set('Authorization', `Bearer ${owner.accessToken}`);
      expect(body.map(({ id }: { id: string }) => id)).not.toContain(lockedAlbumId);
    });

    it('should return locked albums with isLocked=true', async () => {
      const { status, body } = await request(app)
        .get('/albums?isLocked=true')
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(status).toBe(200);
      expect(body).toEqual([expect.objectContaining({ id: lockedAlbumId, isLocked: true })]);
    });

    it('should not count locked albums in statistics', async () => {
      const { body } = await request(app).get('/albums/statistics').set('Authorization', `Bearer ${owner.accessToken}`);
      expect(body.owned).toBe(1);
    });
  });

  describe('PUT /albums/:id/assets', () => {
    it('should lock assets added to a locked album', async () => {
      const { body } = await request(app)
        .put(`/albums/${lockedAlbumId}/assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ids: [ownerAssets[2].id] });

      expect(body).toEqual([{ id: ownerAssets[2].id, success: true }]);
      expect(await getVisibility(owner.accessToken, ownerAssets[2].id)).toBe(AssetVisibility.Locked);
    });

    it('should let the owner add their own assets to a locked album without an elevated session', async () => {
      const { body: login } = await request(app)
        .post('/auth/login')
        .send({ email: createUserDto.user1.email, password: createUserDto.user1.password });
      const background = await utils.createAsset(login.accessToken, { visibility: AssetVisibility.Locked });

      const { body } = await request(app)
        .put(`/albums/${lockedAlbumId}/assets`)
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ ids: [background.id] });
      expect(body).toEqual([{ id: background.id, success: true }]);

      const { status } = await request(app)
        .get(`/albums/${lockedAlbumId}`)
        .set('Authorization', `Bearer ${login.accessToken}`);
      expect(status).toBe(400);

      await request(app)
        .delete(`/albums/${lockedAlbumId}/assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ids: [background.id] });
    });

    it('should not add a locked asset to a regular album', async () => {
      const { body } = await request(app)
        .put(`/albums/${regularAlbumId}/assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ids: [ownerAssets[1].id] });

      expect(body).toEqual([expect.objectContaining({ id: ownerAssets[1].id, success: false })]);
    });
  });

  describe('shared links', () => {
    it('should require a password for a locked album link', async () => {
      const { status } = await request(app)
        .post('/shared-links')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ type: SharedLinkType.Album, albumId: lockedAlbumId });
      expect(status).toBe(400);
    });

    it('should allow a locked album link with a password but not removing it', async () => {
      const { status, body } = await request(app)
        .post('/shared-links')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ type: SharedLinkType.Album, albumId: lockedAlbumId, password: 'secret' });
      expect(status).toBe(201);

      const { status: updateStatus } = await request(app)
        .patch(`/shared-links/${body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ password: '' });
      expect(updateStatus).toBe(400);
    });

    it('should require a password for links to locked assets', async () => {
      const { status } = await request(app)
        .post('/shared-links')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ type: SharedLinkType.Individual, assetIds: [ownerAssets[2].id] });
      expect(status).toBe(400);
    });
  });

  describe('sharing with users', () => {
    beforeAll(async () => {
      await request(app)
        .put(`/albums/${lockedAlbumId}/users`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ albumUsers: [{ userId: recipient.userId, role: AlbumUserRole.Viewer }] });
    });

    it('should hide the locked album from the recipient without an elevated session', async () => {
      const { body } = await request(app).get('/albums').set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(body.map(({ id }: { id: string }) => id)).not.toContain(lockedAlbumId);

      const { status: listStatus } = await request(app)
        .get('/albums?isLocked=true')
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(listStatus).toBe(401);

      const { status: albumStatus } = await request(app)
        .get(`/albums/${lockedAlbumId}`)
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(albumStatus).toBe(400);

      const { status: assetStatus } = await request(app)
        .get(`/assets/${ownerAssets[1].id}`)
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(assetStatus).toBe(400);
    });

    it('should show the locked album to the recipient with an elevated session', async () => {
      await unlock(recipient.accessToken, recipientPin);

      const { body } = await request(app)
        .get('/albums?isLocked=true')
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(body).toEqual([expect.objectContaining({ id: lockedAlbumId })]);

      const { status } = await request(app)
        .get(`/assets/${ownerAssets[1].id}`)
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(status).toBe(200);

      const { body: buckets } = await request(app)
        .get(`/timeline/buckets?albumId=${lockedAlbumId}&visibility=locked`)
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      const total = buckets.reduce((sum: number, { count }: { count: number }) => sum + count, 0);
      expect(total).toBe(2);
    });

    it('should not allow a non-owner to unlock the album', async () => {
      const { status } = await request(app)
        .patch(`/albums/${lockedAlbumId}`)
        .set('Authorization', `Bearer ${recipient.accessToken}`)
        .send({ isLocked: false });
      expect(status).toBe(400);
    });
  });

  describe('partner locked assets', () => {
    beforeAll(async () => {
      await request(app)
        .post('/partners')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ sharedWithId: recipient.userId });
      await request(app)
        .put('/assets')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ids: [ownerAssets[3].id], visibility: AssetVisibility.Locked });
    });

    it('should hide ungranted locked assets from a partner', async () => {
      const { status } = await request(app)
        .get(`/assets/${ownerAssets[3].id}`)
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(status).toBe(400);
    });

    it('should only grant locked assets', async () => {
      const { status } = await request(app)
        .put(`/partners/${recipient.userId}/locked-assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assetIds: [ownerAssets[4].id] });
      expect(status).toBe(400);
    });

    it('should show granted locked assets to the partner', async () => {
      const { status } = await request(app)
        .put(`/partners/${recipient.userId}/locked-assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assetIds: [ownerAssets[3].id] });
      expect(status).toBe(204);

      const { body: grants } = await request(app)
        .get(`/partners/${recipient.userId}/locked-assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(grants).toEqual({ assetIds: [ownerAssets[3].id] });

      const { status: assetStatus } = await request(app)
        .get(`/assets/${ownerAssets[3].id}`)
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      expect(assetStatus).toBe(200);

      const { body: buckets } = await request(app)
        .get('/timeline/buckets?visibility=locked&withPartners=true')
        .set('Authorization', `Bearer ${recipient.accessToken}`);
      const total = buckets.reduce((sum: number, { count }: { count: number }) => sum + count, 0);
      expect(total).toBe(1);
    });

    it('should remove grants when the asset leaves the locked folder', async () => {
      await request(app)
        .put('/assets')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ids: [ownerAssets[3].id], visibility: AssetVisibility.Timeline });

      const { body } = await request(app)
        .get(`/partners/${recipient.userId}/locked-assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(body).toEqual({ assetIds: [] });
    });
  });

  describe('PATCH /albums/:id isLocked', () => {
    it('should lock an existing album, its assets and remove unprotected links', async () => {
      const album = await utils.createAlbum(owner.accessToken, {
        albumName: 'to lock',
        assetIds: [ownerAssets[4].id],
      });
      await request(app)
        .post('/shared-links')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ type: SharedLinkType.Album, albumId: album.id });

      const { status, body } = await request(app)
        .patch(`/albums/${album.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ isLocked: true });
      expect(status).toBe(200);
      expect(body.isLocked).toBe(true);
      expect(await getVisibility(owner.accessToken, ownerAssets[4].id)).toBe(AssetVisibility.Locked);

      const { body: links } = await request(app)
        .get(`/shared-links?albumId=${album.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(links).toEqual([]);

      await request(app)
        .put(`/albums/${album.id}/assets`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ids: [ownerAssets[2].id] });
    });

    it('should unlock an album, returning assets only in it to the timeline', async () => {
      const { status, body } = await request(app)
        .patch(`/albums/${lockedAlbumId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ isLocked: false });
      expect(status).toBe(200);
      expect(body.isLocked).toBe(false);

      expect(await getVisibility(owner.accessToken, ownerAssets[1].id)).toBe(AssetVisibility.Timeline);
      expect(await getVisibility(owner.accessToken, ownerAssets[2].id)).toBe(AssetVisibility.Locked);

      const { body: album } = await request(app)
        .get(`/albums/${lockedAlbumId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(album.assetCount).toBe(1);
    });
  });
});
