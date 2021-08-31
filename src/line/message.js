const path = require('path');
const FileType = require('file-type');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const hasha = require('hasha');

const { BlobServiceClient } = require('@azure/storage-blob');

const root = path.resolve(__dirname, '../..');
const convertPath = path.join(root, 'converts');

const { NODE_ENV, npm_package_name } = process.env;

module.exports = async function (context) {
  // console.log('message:\n\t', context.event.text);

  const userProfile = await context.getUserProfile();
  console.log('userProfile:\n', userProfile);
  const { userId = '', displayName = '' } = userProfile;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const time = today.toTimeString().split(' ')[0];
  const fullDate = `${yyyy}/${mm}/${dd}`;

  const AZURE_STORAGE_CONNECTION_STRING =
    process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!AZURE_STORAGE_CONNECTION_STRING) {
    return;
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
  );

  // Create a unique name for the container
  let containerName = 'unknown';
  if (userId) {
    containerName = `line`;
  }

  console.log('\nCreating container...');
  console.log('\t', containerName);

  // Get a reference to a container
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Create the container
  if (!(await containerClient.exists())) {
    const createContainerResponse = await containerClient.create({
      access: 'container',
    });
    console.log(`Container was created successfully.
      requestId: ${createContainerResponse.requestId}`);
  }

  // for await (const item of containerClient.listBlobsByHierarchy('/', {
  //   prefix: `${fullDate.replace(/\//g, '-')}`,
  // })) {
  //   if (item.kind === 'prefix') {
  //     console.log(`\tBlobPrefix: ${item.name}`);
  //   } else {
  //     console.log(
  //       `\tBlobItem: name - ${item.name}, last modified - ${item.properties.lastModified}`
  //     );
  //   }
  //   console.log(`item: ${JSON.stringify(item, null, 2)}`);
  // }

  let uploadCounter = 1;
  for await (const blob of containerClient.listBlobsFlat({
    prefix: `${userId}/${fullDate.replace(/\//g, '-')}`,
  })) {
    console.log(`Blob: ${blob.name}`);
    if (blob.name.includes('_conv')) {
      uploadCounter++;
    }
  }

  if (context.event.isImage) {
    const buffer = await context.getMessageContent();
    const { ext } = await FileType.fromBuffer(buffer);

    const md5 = await hasha(buffer, { algorithm: 'md5' });

    const origBlobClient = containerClient.getBlockBlobClient(
      `${userId}/${fullDate.replace(/\//g, '-')}/${md5}.${ext}`
    );
    // async upload original file
    const uploadOrigBlobResponse = origBlobClient.upload(
      buffer,
      Buffer.byteLength(buffer)
    );

    if (uploadOrigBlobResponse && uploadOrigBlobResponse.requestId) {
      console.log(`Original blob uploaded successfully. 
        responseId: ${uploadOrigBlobResponse.requestId}`);
    }

    const tempFile = path.join(convertPath, `temp.${ext}`);
    fs.outputFileSync(tempFile, buffer);

    const imageBanner = `${fullDate} ${time} ${displayName} 傳給 ${npm_package_name} 第${uploadCounter}張`;

    console.log(`imageBanner:\n\t${imageBanner}`);

    const convertFile = `${md5}_conv.${ext}`;
    const fontPath =
      NODE_ENV === 'production'
        ? '/app/.fonts/fonts/NotoSansTC-Regular.otf'
        : '/Users/thoyang/Library/Fonts/NotoSansTC-Regular.otf';
    const stdout = execSync(
      `convert ${tempFile} -morphology Edge Octagon -negate -threshold 80% -font "${fontPath}" -annotate +10+20 "${imageBanner}" ${convertFile}`,
      {
        cwd: convertPath,
      }
    );

    // convert without error messages
    if (stdout.toString() === '') {
      const convFilePath = path.join(convertPath, `${convertFile}`);
      const convFileContent = fs.readFileSync(convFilePath);
      const convFileStat = fs.statSync(convFilePath);

      const convBlobClient = containerClient.getBlockBlobClient(
        `${userId}/${fullDate.replace(/\//g, '-')}/${convertFile}`
      );
      const uploadConvBlobResponse = await convBlobClient.upload(
        convFileContent,
        convFileStat.size
      );

      if (uploadConvBlobResponse && uploadConvBlobResponse.requestId) {
        console.log(`Convert blob uploaded successfully. 
        responseId: ${uploadConvBlobResponse.requestId}`);

        const convBlobUrl = convBlobClient.url;
        await context.sendImage({
          originalContentUrl: convBlobUrl,
          previewImageUrl: convBlobUrl,
        });

        fs.remove(convFilePath);
      }
    } else {
      await context.sendText(`Convert error: ${stdout.toString()}`);
    }
  } else {
    await context.sendText(`請傳送一張圖片`);
  }
};
