# Moodle BGU PDF Downloader

A Chrome extension to bulk download course materials (PDFs, PowerPoint, Word, Excel files) from Ben-Gurion University's Moodle platform with section filtering and file type selection.

## Features

- 📚 **Bulk Download**: Download all course materials with one click
- 🎯 **Section Filtering**: Choose specific course sections or download all
- 📝 **Multi-Format Support**: PDF, PPTX, DOCX, XLSX files
- 🎨 **Dynamic File Type Detection**: Only shows file types available in selected sections
- 🗂️ **Smart Organization**: Files organized by Course → Section → File
- 🔒 **Privacy First**: No data collection, all processing happens locally

## Installation

### From Source
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension directory

## Usage

1. Navigate to any BGU Moodle course page (`https://moodle.bgu.ac.il/moodle/course/view.php?id=...`)
2. Click the extension icon in your toolbar
3. Select desired sections (or keep "All Sections" selected)
4. Choose file types to download (checkboxes auto-enable based on available files)
5. Click "Scan & Download PDFs"
6. Files will be downloaded to: `Downloads/[Course Name]/[Section Name]/[File Name]`

## Privacy

This extension does NOT:
- Collect any user data
- Track browsing activity  
- Send data to external servers
- Use analytics or telemetry

All processing happens entirely on your device. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## Permissions

- `downloads`: Required to save files to your computer
- `activeTab`: Required to read the current Moodle course page
- `scripting`: Required to scan course pages for file links
- Host permission (`moodle.bgu.ac.il`): Limited to BGU Moodle only

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Architecture**: 
  - Content script scans Moodle DOM
  - Background service worker orchestrates downloads
  - Popup provides user interface
- **File Detection**: Uses Moodle's icon system to identify file types
- **Folder Support**: Automatically scans folder contents for files

## Development

Built with vanilla JavaScript - no external dependencies.

### Project Structure
```
pdf-downloader/
├── manifest.json       # Extension configuration
├── background.js       # Download orchestration
├── content.js         # Moodle page scanning
├── popup.html/js/css  # User interface
└── icon*.png          # Extension icons
```

## Contributing

Issues and pull requests welcome! Please ensure:
- Code follows existing style
- Test on actual Moodle course pages
- No external dependencies added without discussion

## License

MIT License - see LICENSE file

## Support

For issues or questions:
- GitHub Issues: https://github.com/shpigelgi/moodle-bgu-pdf-downloader/issues
- Email: [your-email]

## Disclaimer

This extension is not affiliated with or endorsed by Ben-Gurion University. Use responsibly and in accordance with your university's acceptable use policies.
