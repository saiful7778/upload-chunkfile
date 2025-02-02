<?php

use App\Http\Controllers\Api\Upload\UploadChunkController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post("/upload", [UploadChunkController::class, "uploadFile"]);
Route::get("/uploaded", [UploadChunkController::class, "getUploadedFiles"]);
Route::delete('/uploaded/{id}', [UploadChunkController::class, 'deleteFile']);
