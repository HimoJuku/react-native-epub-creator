# react-native-epub-creator

A React Native library for creating and manipulating EPUB files. It provides a simple API to create EPUB files, add chapters, and save them to the device's file system.

Compared to original [react-native-epub-creator](https://github.com/CD-Z/react-native-epub-creator), this library is a fork that has been modified to work with Expo and React Native 0.76.

Also removed images and script support, since it was not working and not needed for my use case.
## Installation

These packages have to be installed manually, since the autolink doesn't work automatically.
```sh
// if this is your first expo reliant package
npx install-expo-modules@latest

npm i react-native-zip-archive --save
npm i expo-document-picker --save
npm i expo-file-system --save
```
```sh
npm i @kaze-desu/react-native-epub-creator
```

### IOS

```sh
pod install
```

### ANDROID

```sh
nothing to do
```

## Usage

### Create an Epub
```ts
import EpubBuilder, { FsSettings, ReadDirItem, EpubChapter, EpubSettings, EpubLoader, getValidFileNameByTitle } from 'react-native-epub-creator';

  // Can be used to visualize the progress
  const [progress, setProgress] = React.useState('');
  EpubBuilder.onProgress = (progress, file, operation) => {
    setProgress(Math.round(progress) + '  |  ' + file + '  |  ' + operation);
  };

  var epub = new EpubBuilder({
      title: "example",
      fileName: getValidFileNameByTitle("examplefile-%1"), // optional, it will take title if not set
      language: "en",
      description: "this is a epub test",
      stylesheet: {
        p: {
          width: "100%"
        }
      },
      // If chapters are defined, epub.save() can instantly be called
      chapters: [{
        title: "Air born",
        htmlBody: "<p>this is chapter 1</p>"
      }, {
        title: "chapter 2",
        htmlBody: "<p>this is chapter 2</p>"
      }]
    }, 
      // Optional path to destination folder
      // Opens a folder picker if undefined
      RNFS.DownloadDirectoryPath
  );
  try{     
    await epub.prepare();
    await epub.addChapter({
      title: 'CH 1',
      htmlBody: '<p>Some content</p>',
    });
    await epub
      .save()
      .then((value: string) => console.log(value))
  }catch(error){
   // remove the temp created folder
   await epub.discardChanges();
  }
```

### Read an Existing Epub file
#### Currently not supported
```js
  var path = RNFS.DownloadDirectoryPath +"/example.epub";
  var localProgress=(progress, file)=> {

  })
  var epub = await EpubLoader(path, RNFS, localProgress);
  // you could add new chapters 
  epub.addChapter({
        fileName: getValidFileNameByTitle("examplefile-%1Chapter1"), // optional, it will take title if not set
        title: "chapter 3",
        htmlBody: "<p>this is chapter 3</p>"
      });
    try{
      // save and create the .epub file
      var epubFilePath = await epub.save();
    }catch(error){
     // remove the temp created folder
     await epub.discardChanges();
    }
 
```



## License

MIT
