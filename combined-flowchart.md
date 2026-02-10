# Website Analysis MVP - All Flowcharts

This document contains all 5 flowcharts for the Website Analysis MVP application in Mermaid format.

---

## 1. Main User Flow

Shows the complete user journey from entering a URL to analyzing the next site.

**Updates in v2:**
- Dashboard now explicitly shows "Analysis + 3 Layout Preview Cards"
- New action: "Produce Proposed Layout" with platform-specific export (Squarespace, WordPress, Webflow, Wix, Custom)

```mermaid
flowchart TD
    Start([User Opens App]) --> URLInput[Enter Website URL]
    URLInput --> ValidateURL{Valid URL?}
    ValidateURL -->|No| ErrorMsg[Show Error Message]
    ErrorMsg --> URLInput
    ValidateURL -->|Yes| ShowLoading[Show Loading State]

    ShowLoading --> TakeScreenshot[Capture Full-Page Screenshot]
    TakeScreenshot --> FetchHTML[Fetch Website HTML/CSS]
    FetchHTML --> ExtractAssets[Extract Assets: Colors, Fonts, Images, Copy]
    ExtractAssets --> ClaudeVision[Claude Vision API: Analyze Screenshot]
    ClaudeVision --> ClaudeAnalysis[Claude: Generate Brand Identity Analysis]
    ClaudeAnalysis --> IndustryDetect[Claude: Detect Industry]

    IndustryDetect --> LoadGuidelines[Load Industry Guidelines from DB/JSON]
    LoadGuidelines --> CompareGuidelines[Compare Site Against Guidelines]
    CompareGuidelines --> SelectTemplates[Select 3 Template Combinations]
    SelectTemplates --> GenerateLayouts[Generate 3 HTML Layouts with Extracted Assets]

    GenerateLayouts --> DisplayResults[Display Analysis Dashboard:<br/>Analysis + 3 Layout Preview Cards]
    DisplayResults --> UserReview{User Action?}

    UserReview -->|Add Pros/Cons| AnnotationModal[Open Annotation Text Boxes]
    AnnotationModal --> SaveAnnotations[Save User Annotations to localStorage]
    SaveAnnotations --> DisplayResults

    UserReview -->|Preview Layout| PreviewModal[Open Layout Preview Modal]
    PreviewModal --> DisplayResults

    UserReview -->|Download Layout| DownloadHTML[Download HTML/CSS File]
    DownloadHTML --> DisplayResults

    UserReview -->|Produce Proposed Layout| ProduceLayout[Generate Refined Homepage<br/>+ Platform-Specific Export]
    ProduceLayout --> ExportPlatform{Export for Platform?}
    ExportPlatform -->|Squarespace| ExportSquarespace[Export with Squarespace Build Tools]
    ExportPlatform -->|WordPress| ExportWordPress[Export with WordPress Build Tools]
    ExportPlatform -->|Webflow| ExportWebflow[Export with Webflow Build Tools]
    ExportPlatform -->|Wix| ExportWix[Export with Wix Build Tools]
    ExportPlatform -->|Custom| ExportCustom[Export with Custom Build Tools]

    ExportSquarespace --> DownloadProduction[Download Production-Ready Code]
    ExportWordPress --> DownloadProduction
    ExportWebflow --> DownloadProduction
    ExportWix --> DownloadProduction
    ExportCustom --> DownloadProduction
    DownloadProduction --> DisplayResults

    UserReview -->|Next Site| SaveAnalysis[Save Current Analysis to Database/localStorage]
    SaveAnalysis --> URLInput

    UserReview -->|View History| HistoryView[Display Saved Analyses List]
    HistoryView --> SelectPrevious{Select Analysis?}
    SelectPrevious -->|Yes| LoadAnalysis[Load Analysis from Storage]
    LoadAnalysis --> DisplayResults
    SelectPrevious -->|No| URLInput

    UserReview -->|Export Report| GenerateReport[Generate PDF/Markdown Report]
    GenerateReport --> DownloadReport[Download Report]
    DownloadReport --> DisplayResults

    style Start fill:#9333ea,color:#fff
    style DisplayResults fill:#ec4899,color:#fff
    style ClaudeVision fill:#6366f1,color:#fff
    style ClaudeAnalysis fill:#6366f1,color:#fff
    style IndustryDetect fill:#6366f1,color:#fff
    style ProduceLayout fill:#10b981,color:#fff
    style ExportPlatform fill:#fbbf24,color:#000
```

---

## 2. Technical Architecture & Data Flow

Shows the system architecture with all components and their interactions.

```mermaid
flowchart TB
    subgraph Frontend["Frontend (Single HTML File)"]
        UI[User Interface]
        URLForm[URL Input Form]
        ResultsDisplay[Analysis Display Dashboard]
        LayoutPreviews[3 Layout Preview Cards]
        AnnotationUI[Pros/Cons Text Boxes]
        HistoryList[Analysis History List]
    end

    subgraph Processing["Processing Layer (JavaScript)"]
        URLValidator[URL Validation]
        ScreenshotEngine[Screenshot Capture: Puppeteer/Playwright API]
        HTMLParser[HTML/CSS Parser]
        AssetExtractor[Asset Extraction Engine]
        TemplateEngine[Template Selection & Customization]
        ComparisonEngine[Guidelines Comparison Engine]
    end

    subgraph ClaudeAPI["Claude API Integration"]
        VisionAPI[Claude Vision API: Screenshot Analysis]
        TextAPI[Claude Text API: Industry Detection & Analysis]
        LayoutGenerator[Claude: Template Selection Logic]
    end

    subgraph DataLayer["Data Storage (MVP: localStorage)"]
        AnalysisDB[(Analyses History)]
        GuidelinesDB[(Industry Guidelines JSON)]
        TemplatesDB[(Production Templates)]
        AssetsCache[(Downloaded Assets)]
    end

    subgraph ExternalServices["External Services"]
        TargetWebsite[Target Website]
        ScreenshotService[Screenshot API Service]
        ImageProxy[Image Proxy/CORS Handler]
    end

    UI --> URLForm
    URLForm --> URLValidator
    URLValidator --> ScreenshotEngine
    URLValidator --> HTMLParser

    ScreenshotEngine --> TargetWebsite
    ScreenshotEngine --> ScreenshotService
    HTMLParser --> TargetWebsite
    HTMLParser --> AssetExtractor

    AssetExtractor --> ImageProxy
    AssetExtractor --> VisionAPI
    ScreenshotEngine --> VisionAPI

    VisionAPI --> TextAPI
    TextAPI --> GuidelinesDB
    TextAPI --> ComparisonEngine

    ComparisonEngine --> TemplateEngine
    TemplateEngine --> TemplatesDB
    TemplateEngine --> LayoutGenerator

    LayoutGenerator --> LayoutPreviews
    ComparisonEngine --> ResultsDisplay

    ResultsDisplay --> AnnotationUI
    AnnotationUI --> AnalysisDB
    LayoutPreviews --> AnalysisDB

    AnalysisDB --> HistoryList
    HistoryList --> ResultsDisplay

    AssetExtractor --> AssetsCache

    style ClaudeAPI fill:#6366f1,color:#fff
    style Frontend fill:#ec4899,color:#fff
    style DataLayer fill:#9333ea,color:#fff
```

---

## 3. Claude Integration Sequence Diagram

Shows the detailed sequence of interactions with Claude APIs and other services.

```mermaid
sequenceDiagram
    participant User
    participant App as Website Analysis App
    participant Screenshot as Screenshot Service
    participant Target as Target Website
    participant Vision as Claude Vision API
    participant Text as Claude Text API
    participant DB as Guidelines DB
    participant Templates as Template Library

    User->>App: Enter URL
    App->>Target: Fetch HTML/CSS
    Target-->>App: Return HTML/CSS
    App->>Screenshot: Capture Full Page
    Screenshot->>Target: Load & Screenshot
    Screenshot-->>App: Return Screenshot

    App->>App: Extract Assets (colors, fonts, images, copy)

    par Parallel Analysis
        App->>Vision: Analyze Screenshot + "Describe brand identity, layout, hierarchy"
        Vision-->>App: Brand Analysis + Visual Insights
    and
        App->>Text: Analyze HTML + "Detect industry from content"
        Text-->>App: Industry Classification
    end

    App->>DB: Load Guidelines for Industry
    DB-->>App: Pros/Cons Checklist

    App->>Text: "Compare site against guidelines: {pros}, {cons}"
    Text-->>App: Guideline Comparison Results

    App->>Text: "Select 3 template combinations for {industry} using {assets}"
    Text-->>App: Template Recommendations

    App->>Templates: Load Recommended Templates
    Templates-->>App: Template HTML/CSS

    App->>App: Inject Extracted Assets into Templates
    App->>Screenshot: Generate Previews of 3 Layouts
    Screenshot-->>App: Layout Screenshots

    App->>User: Display Analysis + 3 Layout Options
    User->>App: Add Annotations (Pros/Cons)
    App->>DB: Save Analysis + Annotations

    User->>App: Click "Next Site"
    App->>User: Show URL Input
```

---

## 4. Industry Guidelines System

Shows how industry detection and guidelines application works, including the growth mechanism.

```mermaid
flowchart TD
    Start([Website Analysis Triggered]) --> ExtractContent[Extract: Title, Meta, H1s, Nav, Body Content]
    ExtractContent --> ClaudeDetect[Claude: Analyze Content for Industry Keywords]

    ClaudeDetect --> IndustryResult{Industry Detected?}
    IndustryResult -->|Yes, High Confidence| LoadGuidelines[Load Industry-Specific Guidelines]
    IndustryResult -->|Yes, Low Confidence| ShowOptions[Show Top 3 Industry Options to User]
    IndustryResult -->|No| DefaultGuidelines[Load Generic Web Design Guidelines]

    ShowOptions --> UserSelect{User Selects Industry?}
    UserSelect -->|Yes| LoadGuidelines
    UserSelect -->|No| DefaultGuidelines

    LoadGuidelines --> CheckSource{Guidelines Source?}
    CheckSource -->|Hardcoded| LoadHardcoded[Load from industries.js]
    CheckSource -->|Database| FetchDB[Fetch from Backend API]
    CheckSource -->|Hybrid| MergeData[Merge Hardcoded + Database]

    LoadHardcoded --> ApplyGuidelines[Apply Guidelines to Analysis]
    FetchDB --> ApplyGuidelines
    MergeData --> ApplyGuidelines
    DefaultGuidelines --> ApplyGuidelines

    ApplyGuidelines --> CompareWebsite[Compare Website Against Each Guideline]
    CompareWebsite --> ClaudeScore[Claude: Score Each Guideline Item]

    ClaudeScore --> GenerateReport[Generate Pros/Cons Report]
    GenerateReport --> DisplayToUser[Display in UI]

    DisplayToUser --> UserAnnotates[User Adds Custom Pros/Cons]
    UserAnnotates --> SaveToStorage[Save to Database/localStorage]

    SaveToStorage --> FeedbackLoop{Contribute to Guidelines?}
    FeedbackLoop -->|Yes| UpdateDatabase[Add User Annotations to Industry Guidelines DB]
    FeedbackLoop -->|No| End([Analysis Complete])
    UpdateDatabase --> End

    style ClaudeDetect fill:#6366f1,color:#fff
    style ClaudeScore fill:#6366f1,color:#fff
    style UpdateDatabase fill:#10b981,color:#fff
    style SaveToStorage fill:#ec4899,color:#fff
```

---

## 5. Data Storage Evolution

Shows the migration path from MVP (localStorage) to production (backend database).

```mermaid
flowchart LR
    subgraph Phase1["MVP: localStorage Only"]
        LS1[analyses: Array of Analysis Objects]
        LS2[guidelines: Industry Guidelines JSON]
        LS3[templates: Template Library]
        LS4[userPreferences: Settings]
    end

    subgraph Phase2["Hybrid: localStorage + JSON Files"]
        LS5[analyses: Array]
        JSON1[guidelines.json: Fetch from Server]
        JSON2[templates.json: Fetch from Server]
        LS6[userPreferences: Settings]
    end

    subgraph Phase3["Backend Database"]
        DB1[(Analyses Table)]
        DB2[(Guidelines Table)]
        DB3[(Industries Table)]
        DB4[(Templates Table)]
        DB5[(UserAnnotations Table)]
        DB6[(Assets Table)]
    end

    Phase1 --> Phase2
    Phase2 --> Phase3

    LS1 -.Migrate.-> LS5
    LS2 -.Migrate.-> JSON1
    LS3 -.Migrate.-> JSON2
    LS4 -.Migrate.-> LS6

    LS5 -.Migrate.-> DB1
    JSON1 -.Migrate.-> DB2
    JSON1 -.Migrate.-> DB3
    JSON2 -.Migrate.-> DB4
    LS6 -.Migrate.-> DB5

    style Phase1 fill:#fbbf24,color:#000
    style Phase2 fill:#f59e0b,color:#000
    style Phase3 fill:#10b981,color:#fff
```

---

## Color Legend

- **Purple (#9333ea)**: Start/End states, Storage operations
- **Pink (#ec4899)**: User actions and interactions
- **Blue (#6366f1)**: Claude API calls
- **Yellow (#fbbf24)**: Decision points
- **Light Blue (#dbeafe)**: Processing steps
- **Green (#10b981)**: Success/completion states
- **Red (#ef4444)**: Error states
- **Orange (#f59e0b)**: Phase 2 in evolution
- **Gold (#fbbf24)**: Phase 1 in evolution

---

## Usage

These Mermaid diagrams can be:

1. **Viewed on GitHub**: GitHub automatically renders Mermaid diagrams
2. **Imported to draw.io**: File → Import → Paste Mermaid code
3. **Imported to Lucid.app**: Create new diagram → Import Mermaid
4. **Rendered online**: Use [Mermaid Live Editor](https://mermaid.live/)
5. **Converted to images**: Use Mermaid CLI or online tools

---

## Technical Notes

**Mermaid Syntax:**
- `flowchart TD` = Top-Down flowchart
- `flowchart LR` = Left-Right flowchart
- `flowchart TB` = Top-Bottom flowchart
- `sequenceDiagram` = Sequence diagram for interactions
- `-->` = Arrow/connection
- `-->|Label|` = Labeled arrow
- `style` = Apply custom colors

**Rendering Requirements:**
- Mermaid.js library (for web rendering)
- Compatible viewer (GitHub, GitLab, Notion, Obsidian, etc.)
- Or export to SVG/PNG for universal compatibility
