import EpubFile, {
  EpubChapter,
  EpubSettings,
  File as EpubFileClass,
} from '@cd-z/epub-constructor';
import { zip } from 'react-native-zip-archive';
import { File, Directory, Paths } from 'expo-file-system/next';
import * as DocumentPicker from 'expo-document-picker';

const getEpubfileName = (name: string) => {
  return name.replace(/\..*$/g, '') + '.epub';
};

const validateDir = async (path: string) => {
  try {
    const dir = new Directory(path);
    if (!dir.exists) {
      dir.create();
    }
    return dir;
  } catch (error) {
    throw error;
  }
};

const removeDir = async (path: string) => {
  try {
    const dir = new Directory(path);
    if (dir.exists) {
      dir.delete();
    }
  } catch (error) {
    throw error;
  }
};

const checkFile = (path: string) => {
  var name = path.split('/').reverse()[0].toLocaleLowerCase();
  var fileExtension = [
    '.json',
    '.html',
    '.xml',
    '.opf',
    '.ncx',
    '.css',
    'mimetype',
    '.epub',
  ];
  var fileInfo = {
    isDirectory: !fileExtension.find(x => name.indexOf(x) !== -1),
    folderPath:
      path.split('/').length > 1 &&
      fileExtension.find(x => name.indexOf(x) !== -1)
        ? path
            .split('/')
            .reverse()
            .filter((x, index) => index > 0)
            .reverse()
            .join('/')
        : path,
  };
  return fileInfo;
};

const getFolderPath = (path: string) => {
  var file = checkFile(path);
  return file.folderPath;
};

export default class EpubBuilder {
  private epub: EpubFile;
  private outputPath?: string;
  private tempPath?: string;
  private tempOutputPath: string;
  private fileName: string;
  private dProgress: number = 0;
  private prepared: boolean = false;

  static onProgress?: (
    progress: number,
    epubFile: string,
    operation:
      | 'constructEpub'
      | 'SaveFile'
      | 'LoadingFile'
      | 'Zip'
      | 'Unzip'
      | 'Reading'
      | 'Finished',
  ) => void;

  public onSaveProgress?: (
    progress: number,
    epubFile: string,
    operation: 'constructEpub' | 'SaveFile' | 'Finished',
  ) => Promise<void>;

  constructor(settings: EpubSettings, destinationFolderPath?: string) {
    this.epub = new EpubFile(settings);
    this.fileName = this.epub.epubSettings.fileName!;
    this.tempOutputPath = `${Paths.cache}/output/`;
    this.outputPath = destinationFolderPath
      ? getFolderPath(destinationFolderPath)
      : undefined;
  }

  public getEpubSettings() {
    return this.epub.epubSettings;
  }

  public async prepare() {
    this.prepared = true;
    await this.createTempFolder();
    if (!this.epub.epubSettings.chapters) {
      this.epub.epubSettings.chapters = [] as EpubChapter[];
    }
    return this;
  }

  public async discardChanges() {
    try {
      if (this.tempPath) {
        await removeDir(this.tempPath);
        await removeDir(this.tempOutputPath);
      }
      this.tempPath = undefined;
    } catch (error) {
      throw error;
    }
  }

  public async addChapter(epubChapter: EpubChapter) {
    if (!this.prepared || !this.epub.epubSettings.chapters) {
      throw new Error('Please run the prepare method first');
    }
    this.epub.epubSettings.chapters.push(epubChapter);
  }

  public async save(removeTempFile?: boolean) {
    const epubFileName = getEpubfileName(this.fileName);
    const tempOutputFile = this.tempOutputPath + epubFileName;

    if (!this.prepared) {
      await this.createTempFolder();
    }
    const outputFile = `${this.outputPath}/${epubFileName}`;

    await this.populate();
    await removeDir(this.tempOutputPath);

    if (this.tempPath) {
      await validateDir(this.tempOutputPath);
      await zip(this.tempPath, tempOutputFile);

      const sourceFile = new File(tempOutputFile);
      const destFile = new File(outputFile);
      if (destFile.exists) {
        destFile.delete();
      }
      sourceFile.copy(destFile.parentDirectory);
    }

    if (removeTempFile !== false) {
      await this.discardChanges();
    }

    this.dProgress = 100;
    EpubBuilder.onProgress?.(this.dProgress, epubFileName, 'Finished');

    return outputFile;
  }

  private async pickFolder() {
    try {
      // 使用DocumentPicker替代SAF的openDocumentTree
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/*',
        copyToCacheDirectory: false,
        multiple: false,
      });
      
      if (result.canceled === false) {
        // 获取父目录
        const uri = result.assets[0].uri;
        const lastSlash = uri.lastIndexOf('/');
        this.outputPath = uri.substring(0, lastSlash);
        return;
      }
      throw new Error('No folder selected.');
    } catch (error) {
      throw new Error('No permissions to access destination folder granted.');
    }
  }

  private async createTempFolder() {
    this.tempPath = `${Paths.cache}/epubCreation/${this.fileName}`;
    await validateDir(this.tempPath);

    if (!this.outputPath) {
      await this.pickFolder();
    }
  }

  public async populate() {
    var overrideFiles = ['toc.ncx', 'toc.html', '.opf', '.json'];
    const epubFileName = getEpubfileName(this.fileName);
    const epub = new EpubFile(this.epub.epubSettings);

    const files: EpubFileClass[] = await epub.constructEpub(async (progress: number) => {
      EpubBuilder.onProgress?.(this.dProgress, epubFileName, 'constructEpub');
      if (this.onSaveProgress) {
        await this.onSaveProgress?.(progress, epubFileName, 'constructEpub');
      }
    });

    this.dProgress = 0;

    var len = files.length + 1;
    for (var i = 0; i < files.length; i++) {
      this.dProgress = ((i + 1) / parseFloat(len.toString())) * 100;
      const file = files[i];
      var path = this.tempPath + '/' + file.path;
      
      // 检查文件是否存在并需要覆盖
      const targetFile = new File(path);
      if (overrideFiles.find(f => file.path.indexOf(f) !== -1) && targetFile.exists) {
        targetFile.delete();
      }
      
      var fileSettings = checkFile(file.path);
      if (!fileSettings.isDirectory) {
        await validateDir(path);
      }
      
      // 创建或写入文件
      const newFile = new File(path);
      if (!newFile.exists) {
        if (file.isImage) {
          await validateDir(this.tempPath + '/OEBPS/images');
          const sourceFile = new File(file.content);
          sourceFile.copy(new Directory(path).parentDirectory);
        } else {
          if (file.path !== 'mimetype') {
            newFile.create();
            newFile.write(file.content);
          }
        }
      }
      
      if (this.outputPath) {
        EpubBuilder.onProgress?.(this.dProgress, epubFileName, 'SaveFile');
        if (this.onSaveProgress) {
          await this.onSaveProgress?.(this.dProgress, epubFileName, 'SaveFile');
        }
      }
    }
  }
}
