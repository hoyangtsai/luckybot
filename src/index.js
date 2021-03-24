const path = require('path');
const FileType = require('file-type');
const imgur = require('imgur');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const hasha = require('hasha');

imgur.setClientId('7c7c95472cb8e01');

module.exports = async function App(context) {
  if (context.event.isImage) {
    const buffer = await context.getMessageContent();
    const { ext } = await FileType.fromBuffer(buffer);

    const md5 = await hasha(buffer, { algorithm: 'md5' });

    const filename = `${md5}.${ext}`;
    const filepath = path.join(__dirname, `${filename}`);

    // if (fs.existsSync(filepath)) {
    //   await context.sendText(`圖片已傳過 🧐`);
    // } else {
    fs.writeFileSync(filepath, buffer);

    const convertFile = path.basename(filepath, `.${ext}`) + `_conv.${ext}`;
    execSync(
      `convert ${filename} -morphology Edge Octagon -negate -threshold 80% ${convertFile}`,
      {
        cwd: __dirname,
      }
    );

    imgur
      .uploadFile(path.join(__dirname, convertFile))
      .then(async (json) => {
        // console.log('json =>', json);
        const { link } = json;
        await context.sendImage({
          originalContentUrl: link,
          previewImageUrl: link,
        });
      })
      .catch((err) => {
        console.error('imgur:', err.message);
      });
    // }
  }
  // else {
  //   await context.sendText(`請傳送一張圖片。`);
  // }
};
