import { compressProfilePhoto } from './profilePhoto';

describe('compressProfilePhoto', () => {
  const originalImage = global.Image;
  const originalCreateImageBitmap = global.createImageBitmap;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  afterEach(() => {
    global.Image = originalImage;
    global.createImageBitmap = originalCreateImageBitmap;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    jest.restoreAllMocks();
  });

  test('uses image-element decoding and scales until the photo fits the Firestore size limit', async () => {
    global.createImageBitmap = undefined;
    const revokeObjectURL = jest.fn();
    URL.createObjectURL = jest.fn(() => 'blob:profile-photo');
    URL.revokeObjectURL = revokeObjectURL;

    class ImageMock {
      width = 1200;
      height = 600;

      set src(value) {
        this.source = value;
        this.onload();
      }
    }
    global.Image = ImageMock;

    const drawImage = jest.fn();
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage }));
    HTMLCanvasElement.prototype.toBlob = jest.fn(function (callback) {
      const size = this.width > 900 ? 600000 : 400000;
      callback(size > 500000 ? { size } : new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
    });

    const result = await compressProfilePhoto(new File(['image'], 'profile.heic', { type: 'image/heic' }));

    expect(result).toMatch(/^data:image\/jpeg;base64,/);
    expect(drawImage).toHaveBeenCalledWith(expect.any(ImageMock), 0, 0, 867, 433);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:profile-photo');
  });

  test('reports image formats that neither browser decoder can read', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.createImageBitmap = jest.fn().mockRejectedValue(new Error('bitmap decode failed'));
    URL.createObjectURL = jest.fn(() => 'blob:invalid-photo');
    URL.revokeObjectURL = jest.fn();

    class ImageMock {
      set src(value) {
        this.source = value;
        this.onerror();
      }
    }
    global.Image = ImageMock;

    await expect(compressProfilePhoto(new File(['image'], 'profile.unknown', { type: 'image/unknown' })))
      .rejects.toThrow('This image format could not be decoded by the browser.');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:invalid-photo');
  });
});
