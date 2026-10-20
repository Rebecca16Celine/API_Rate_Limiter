# Medical Imaging Triage Assistant

### Comparative Evaluation of ResNet-50 and Vision Transformer for Multi-Label Chest X-ray Classification

## 1. Project Overview

The Medical Imaging Triage Assistant is a research and educational project for multi-label chest X-ray classification. It compares ResNet-50, a convolutional neural network, with Vision Transformer Base/16 (ViT-B/16) using a subset of the NIH ChestX-ray14 dataset.

The selected ResNet-50 model is integrated into a Flask-based web application. Users can upload a chest X-ray and view the top three predicted findings, relative review priority, confidence-based review status, and a Grad-CAM visualization.

**Disclaimer:** This is a research prototype, not a medical diagnostic tool. Predictions, review-priority categories, and confidence-based statuses have not been clinically validated.

## 2. Objectives

- Implement multi-label chest X-ray classification for 14 disease findings.
- Train and compare ResNet-50 and ViT-B/16.
- Evaluate both models using ROC-AUC, precision, recall, and F1-score.
- Select a model for the web application based on experimental results.
- Assign relative review-priority categories.
- Flag predictions using the gap between the two highest predicted probabilities.
- Integrate Grad-CAM for visual explanation.
- Develop a Flask-based web interface.

## 3. Dataset

The project uses a subset of the NIH ChestX-ray14 dataset, comprising images from `images_001` through `images_005`.

| Dataset detail | Count |
|---|---:|
| Unique images | 44,999 |
| Training images | 31,691 |
| Validation images | 5,584 |
| Test images | 7,724 |
| Output classes | 14 |
| Input resolution | 224 × 224 |

The data was split at the patient level, with no overlapping patients between the training/validation data and the test set.

### Disease classes

1. Atelectasis
2. Cardiomegaly
3. Consolidation
4. Edema
5. Effusion
6. Emphysema
7. Fibrosis
8. Hernia
9. Infiltration
10. Mass
11. Nodule
12. Pleural Thickening
13. Pneumonia
14. Pneumothorax

"No Finding" is represented by an all-zero label vector rather than a fifteenth output class.

The dataset is not included in this repository. Obtain it from its authorized source and prepare the required files separately.

## 4. Preprocessing

- Convert images to RGB.
- Resize images to 224 × 224 pixels.
- Convert images to tensors.
- Normalize using ImageNet statistics.
- Apply random horizontal flipping and random rotation of up to 5 degrees during training only.

ImageNet mean: `[0.485, 0.456, 0.406]`

ImageNet standard deviation: `[0.229, 0.224, 0.225]`

Validation and test images use resizing and normalization without random augmentation.

## 5. Model Training

Both models were initialized with ImageNet-pretrained weights and adapted for 14-output multi-label classification.

| Parameter | Value |
|---|---|
| Models | ResNet-50 and ViT-B/16 |
| Epochs | 5 |
| Batch size | 8 |
| Optimizer | Adam |
| Learning rate | 0.0001 |
| Loss function | Weighted BCEWithLogitsLoss |
| Decision threshold | 0.5 |

Both models were evaluated on the same held-out test set.

## 6. Results

| Metric | ResNet-50 | ViT-B/16 |
|---|---:|---:|
| Macro ROC-AUC | 0.7254 | 0.5863 |
| Micro ROC-AUC | 0.7373 | 0.6047 |
| Macro Precision | 0.1110 | 0.0859 |
| Macro Recall | 0.7907 | 0.6058 |
| Macro F1-score | 0.1866 | 0.1411 |
| Micro Precision | 0.1210 | 0.0925 |
| Micro Recall | 0.8136 | 0.6207 |
| Micro F1-score
