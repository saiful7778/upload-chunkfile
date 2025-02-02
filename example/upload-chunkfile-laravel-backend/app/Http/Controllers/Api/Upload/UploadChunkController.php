<?php

namespace App\Http\Controllers\Api\Upload;

use App\Http\Controllers\Controller;
use App\Models\UploadedFile;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UploadChunkController extends Controller
{
    public function uploadFile(Request $request): JsonResponse
    {

        // Validate the request
        $validate = Validator::make($request->all(), [
            "fileName" => [
                "required",
                "string",
                function ($attribute, $value, $fail) {
                    // Validate file name extension
                    $allowedExtensions = ['mp4', 'mov', 'avi', 'mp3', 'wav', 'jpg', 'jpeg', 'png', 'gif'];
                    $extension = pathinfo($value, PATHINFO_EXTENSION);

                    if (!in_array(strtolower($extension), $allowedExtensions)) {
                        $fail("The $attribute must be a video, audio, or image file.");
                    }
                },
            ],
            "currentChunk" => "required|integer",
            "totalChunk" => "required|integer",
            "file" => "required|file",
        ]);

        if ($validate->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation error', 'errors' => $validate->errors(), 'code' => 422], 422);
        }

        $fileName = $request->fileName;
        $currentChunk = $request->currentChunk;
        $totalChunk = $request->totalChunk;

        // Create a unique temporary directory for this upload session
        $tempDir = storage_path('app/temp/' . md5($fileName));

        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0777, true);
        }

        // Save the chunk
        $chunkPath = $tempDir . '/' . $currentChunk;
        file_put_contents($chunkPath, $request->file('file')->get());

        // Check if all chunks are uploaded
        if (count(scandir($tempDir)) - 2 == $totalChunk) {
            // Handle file name conflicts in the final uploads directory
            $finalFileName = $this->getUniqueFileName($fileName);
            // dd($finalFileName);
            $finalPath = public_path("/uploads/" . $finalFileName);

            // Combine chunks
            $output = fopen($finalPath, 'w');

            for ($i = 0; $i < $totalChunk; $i++) {
                $chunkPath = $tempDir . '/' . $i;
                $chunkData = fopen($chunkPath, 'r');

                stream_copy_to_stream($chunkData, $output);

                fclose($chunkData);
                unlink($chunkPath); // Delete chunk
            }

            fclose($output);
            rmdir($tempDir); // Remove temp directory

            // Store file info in the database
            $fileType = mime_content_type($finalPath);
            $fileSize = filesize($finalPath);

            UploadedFile::create([
                'file_name' => $finalFileName,
                'file_type' => $fileType,
                'file_size' => $fileSize,
                'file_path' => 'uploads/' . $finalFileName, // Store the relative path
            ]);

            // Clean up old temporary folders
            $this->cleanupOldTempFolders();

            return response()->json(['success' => true, 'message' => 'File uploaded successfully.', 'data' => ['file' => $finalFileName]], 201);
        }

        return response()->json(['success' => true, 'message' => 'Chunk uploaded successfully.', 'code' => 201], 201);
    }

    /**
     * Generate a unique file name to avoid conflicts.
     */
    private function getUniqueFileName(string $fileName): string
    {
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);
        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
        $finalPath =  public_path("/uploads/" . $fileName);


        // If the file already exists, append a timestamp to make it unique
        if (file_exists($finalPath)) {
            $fileName = $baseName . '_' . time() . '.' . $extension;
        }

        return $fileName;
    }

    /**
     * Delete temporary folders older than 5 hours.
     */
    private function cleanupOldTempFolders(): void
    {
        $tempBaseDir = storage_path('app/temp');
        $now = Carbon::now();
        $folders = glob($tempBaseDir . '/*', GLOB_ONLYDIR);

        foreach ($folders as $folder) {
            $lastModified = Carbon::createFromTimestamp(filemtime($folder));

            if ($lastModified->diffInHours($now) >= 5) {
                $this->deleteDirectory($folder);
            }
        }
    }

    /**
     * Recursively delete a directory.
     */
    private function deleteDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->deleteDirectory($path) : unlink($path);
        }

        rmdir($dir);
    }

    public function getUploadedFiles(): JsonResponse
    {
        $files = UploadedFile::all();
        if (!$files) {
            return response()->json(['success' => false, 'message' => 'No files found.', 'code' => 404], 404);
        }
        return response()->json(['success' => true, 'message' => 'All file data', 'data' => $files, 'code' => 200], 200);
    }

    /**
     * Delete an uploaded file and its database record.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function deleteFile($id): JsonResponse
    {
        // Find the file record in the database
        $uploadedFile = UploadedFile::find($id);

        if (!$uploadedFile) {
            return response()->json([
                'success' => false,
                'message' => 'File not found.',
                'code' => 404,
            ], 404);
        }

        // Delete the file from storage
        $filePath = public_path($uploadedFile->file_path);

        if (file_exists($filePath)) {
            unlink($filePath); // Delete the file
        }

        // Delete the record from the database
        $uploadedFile->delete();

        return response()->json([
            'success' => true,
            'message' => 'File deleted successfully.',
            'code' => 200,
        ], 200);
    }
}
