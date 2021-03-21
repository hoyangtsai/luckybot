const path = require('path');
const FileType = require('file-type');
// const fs = require('fs-extra');
const gm = require('gm').subClass({ imageMagick: true });
const imgur = require('imgur');

imgur.setClientId('7c7c95472cb8e01');

module.exports = async function App(context) {
  if (context.event.isText) {
    await context.sendText(`received the text message: ${context.event.text}`);
  } else if (context.event.isPayload) {
    await context.sendText(`received the payload: ${context.event.payload}`);
  } else if (
    context.event.isImage ||
    context.event.isVideo ||
    context.event.isAudio
  ) {
    const buffer = await context.getMessageContent();
    const { ext } = await FileType.fromBuffer(buffer);

    const filename = path.join(__dirname, `tmp-file.${ext}`);

    // fs.writeFileSync(filename, buffer);
    gm(buffer)
      .colorspace('GRAY')
      // .threshold('50%')
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
};
