const path = require('path');
const FileType = require('file-type');
const gm = require('gm').subClass({ imageMagick: true });
const imgur = require('imgur');

imgur.setClientId('7c7c95472cb8e01');

module.exports = async function App(context) {
  if (context.event.isImage) {
    const buffer = await context.getMessageContent();
    const { ext } = await FileType.fromBuffer(buffer);

    const filename = path.join(__dirname, `tmp.${ext}`);

    gm(buffer)
      .colorspace('GRAY')
      .level('30%', '60%')
      .threshold('56%')
      // .monochrome()
      .write(filename, function (err) {
        if (!err) {
          console.log('done');
          imgur
            .uploadFile(filename)
            .then(async (json) => {
              // console.log('json =>', json);
              const { link } = json;
              await context.sendImage({
                originalContentUrl: link,
                previewImageUrl: link,
              });
            })
            .catch((err) => {
              console.error(err.message);
            });
        }
      });
  }
  // else {
  //   await context.sendText(`請傳送一張圖片。`);
  // }
};
