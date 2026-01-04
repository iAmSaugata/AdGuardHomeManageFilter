Add-Type -AssemblyName System.Drawing
$sourcePath = "C:\Users\saugata.datta\.gemini\antigravity\brain\c633e7b4-ef92-4af1-aff1-9afba7214b79\app_icon_transparent_1767523071721.png"
$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-Image {
    param($img, $w, $h, $out)
    $destImg = New-Object System.Drawing.Bitmap($w, $h)
    $graph = [System.Drawing.Graphics]::FromImage($destImg)
    $graph.Clear([System.Drawing.Color]::Transparent)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.DrawImage($img, 0, 0, $w, $h)
    $destImg.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $destImg.Dispose()
}

Resize-Image $sourceImg 128 128 "c:\Users\saugata.datta\OneDrive - Accenture\Documents\GIT-Repo-AG\AdGuardHomeManageFilter\icons\icon128.png"
Resize-Image $sourceImg 48 48 "c:\Users\saugata.datta\OneDrive - Accenture\Documents\GIT-Repo-AG\AdGuardHomeManageFilter\icons\icon48.png"
Resize-Image $sourceImg 16 16 "c:\Users\saugata.datta\OneDrive - Accenture\Documents\GIT-Repo-AG\AdGuardHomeManageFilter\icons\icon16.png"

$sourceImg.Dispose()
