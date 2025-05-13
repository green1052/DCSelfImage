<script lang="ts" setup>
import { Storage } from "@plasmohq/storage";
import ky from "ky";
import { onMounted, ref, watch } from "vue";

const storage = new Storage();

const groupList = ref<Group[]>([
    {
        text: "기본",
        value: 0,
        randomEnabled: false
    }
]);

const currentGroup = ref(0);
const isUploading = ref(false);

const imageList = ref<Record<number, Image[]>>({ 0: [] });

const galleryList = ref<Gallery[]>([]);
const currentGallery = ref<Gallery | null>(null);
const newGalleryId = ref("");
const selectedGroups = ref<number[]>([]);
const isShowGalleryForm = ref(false);

const selectedImages = ref<number[]>([]);
const selectAllChecked = ref(false);

const settings = ref<Settings>({
    webpConversion: false,
    nameObfuscation: false
});

onMounted(async () => {
    const groups = await storage.get<Group[]>("groups");

    if (groups) {
        groupList.value = groups;
        watch(groupList, (newVal) => storage.set("groups", newVal), { deep: true });
    } else {
        await storage.set("groups", [{ text: "기본", value: 0, randomEnabled: false }]);
    }

    const images = await storage.get<Record<number, Image[]>>("images");

    if (images) {
        imageList.value = images;
        watch(
            imageList,
            (newVal) => {
                storage.set("images", newVal);
            },
            { deep: true }
        );
    } else {
        await storage.set("images", { 0: [] });
    }

    const galleries = await storage.get<Gallery[]>("galleries");
    if (galleries) {
        galleryList.value = galleries;
        watch(galleryList, (newVal) => storage.set("galleries", newVal), { deep: true });
    } else {
        await storage.set("galleries", []);
    }

    const savedSettings = await storage.get<Settings>("settings");
    if (savedSettings) {
        settings.value = savedSettings;
        watch(settings, (newVal) => storage.set("settings", newVal), { deep: true });
    } else {
        await storage.set("settings", settings.value);
    }

    watch(currentGroup, () => {
        selectedImages.value = [];
        selectAllChecked.value = false;
    });
});

function addGroup() {
    const groupName = prompt("그룹 이름을 입력하세요", `그룹 ${groupList.value.length}`);

    if (!groupName) return;

    groupList.value.push({
        text: groupName,
        value: Date.now(),
        randomEnabled: false
    });

    imageList.value[currentGroup.value] = [];
    currentGroup.value = groupList.value.find((v) => v.text === groupName).value;
}

function editGroup() {
    const find = groupList.value.find((v) => v.value === currentGroup.value);
    const newName = prompt("수정할 이름", find.text);

    if (!newName) return;

    find.text = newName;
}

function removeGroup() {
    delete imageList.value[currentGroup.value];

    const find = groupList.value.find((v) => v.value === currentGroup.value);
    const index = groupList.value.indexOf(find);

    groupList.value.splice(index, 1);

    currentGroup.value = groupList.value[index - 1].value;
}

function toggleRandomForCurrentGroup() {
    const groupIndex = groupList.value.findIndex((v) => v.value === currentGroup.value);
    const group = groupList.value[groupIndex];

    group.randomEnabled ??= false;
    group.randomEnabled = !group.randomEnabled;
}

function isRandomEnabledForCurrentGroup() {
    const group = groupList.value.find((v) => v.value === currentGroup.value);
    return group?.randomEnabled ?? false;
}

function startAddGallery() {
    isShowGalleryForm.value = true;
    newGalleryId.value = "";
    selectedGroups.value = [];
    currentGallery.value = null;
}

function startEditGallery(gallery: Gallery) {
    isShowGalleryForm.value = true;
    currentGallery.value = gallery;
    newGalleryId.value = gallery.id;
    selectedGroups.value = [...gallery.groups];
}

function saveGallery() {
    if (!newGalleryId.value.trim()) {
        alert("갤러리 ID를 입력해주세요.");
        return;
    }

    if (selectedGroups.value.length === 0) {
        alert("적어도 하나의 그룹을 선택해주세요.");
        return;
    }

    const isDuplicate = galleryList.value.some(
        (v) => v.id === newGalleryId.value && (!currentGallery.value || v.id !== currentGallery.value.id)
    );

    if (isDuplicate) {
        alert("이미 존재하는 갤러리 ID입니다.");
        return;
    }

    if (currentGallery.value) {
        const index = galleryList.value.findIndex((v) => v.id === currentGallery.value!.id);

        galleryList.value[index] = {
            id: newGalleryId.value,
            groups: selectedGroups.value
        };
    } else {
        galleryList.value.push({
            id: newGalleryId.value,
            groups: selectedGroups.value
        });
    }

    newGalleryId.value = "";
    selectedGroups.value = [];
    isShowGalleryForm.value = false;
    currentGallery.value = null;
}

function cancelGalleryEdit() {
    newGalleryId.value = "";
    selectedGroups.value = [];
    isShowGalleryForm.value = false;
    currentGallery.value = null;
}

function removeGallery(gallery: Gallery) {
    const index = galleryList.value.findIndex((v) => v.id === gallery.id);
    galleryList.value.splice(index, 1);
}

function toggleGroupSelection(groupValue: number) {
    const index = selectedGroups.value.indexOf(groupValue);

    if (index === -1) {
        selectedGroups.value.push(groupValue);
        return;
    }

    selectedGroups.value.splice(index, 1);
}

async function imageUpload(files: FileList) {
    try {
        isUploading.value = true;

        const dom = new DOMParser().parseFromString(
            await ky.get("https://gall.dcinside.com/board/write/?id=nmh", { timeout: 30000 }).text(),
            "text/html"
        );

        const rKey = dom.querySelector<HTMLInputElement>("#r_key").value;

        for (let file of files) {
            try {
                if (settings.value.nameObfuscation) {
                    file = new File(
                        [file],
                        `${Math.random().toString(36).substring(2, 15)}.${file.name.split(".").at(-1)}`
                    );
                }

                const params = new FormData();
                params.set("r_key", rKey);
                params.set("upload_ing", "N");
                params.set("files[]", file);

                const response = await ky
                    .post("https://upimg.dcinside.com/upimg_file.php", {
                        timeout: 30000,
                        searchParams: {
                            id: "nmh",
                            r_key: rKey
                        },
                        body: params
                    })
                    .json<DcinsideImage>();

                const img = response.files[0];

                imageList.value[currentGroup.value] ??= [];
                imageList.value[currentGroup.value].push({
                    imageurl: img.url,
                    filename: img.name,
                    filesize: img.size,
                    imagealign: "L",
                    originalurl: img.url,
                    thumburl: img._s_url,
                    file_temp_no: img.file_temp_no
                });
            } catch (e) {
                alert(`이미지 업로드에 실패했습니다. 오류: ${e}`);
            }
        }
    } catch (e) {
        alert(`이미지 업로드에 실패했습니다. 오류: ${e}`);
    } finally {
        isUploading.value = false;
    }
}

function toggleImageSelection(index: number) {
    const selectedIndex = selectedImages.value.indexOf(index);

    if (selectedIndex === -1) {
        selectedImages.value.push(index);
    } else {
        selectedImages.value.splice(selectedIndex, 1);
    }

    selectAllChecked.value = selectedImages.value.length === (imageList.value[currentGroup.value]?.length ?? 0);
}

function toggleSelectAll() {
    if (selectAllChecked.value) {
        selectedImages.value = imageList.value[currentGroup.value]
            ? [...Array(imageList.value[currentGroup.value].length).keys()]
            : [];
    } else {
        selectedImages.value = [];
    }
}

function deleteSelectedImages() {
    if (selectedImages.value.length === 0) {
        alert("삭제할 이미지를 선택해주세요.");
        return;
    }

    const sortedIndices = [...selectedImages.value].sort((a, b) => b - a);

    for (const index of sortedIndices) {
        imageList.value[currentGroup.value].splice(index, 1);
    }

    selectedImages.value = [];
    selectAllChecked.value = false;
}

function removeImage(index: number) {
    imageList.value[currentGroup.value].splice(index, 1);

    selectedImages.value = selectedImages.value.filter((v) => v !== index).map((v) => (v > index ? v - 1 : v));
}
</script>

<template>
    <div class="container">
        <header>
            <h1>자짤 설정</h1>
        </header>

        <section class="settings-section">
            <h2>설정</h2>
            <div class="settings-card">
                <div class="setting-item">
                    <label>
                        <span class="setting-label">WebP 변환 (미구현)</span>
                        <div class="toggle-switch">
                            <input
                                id="webp-toggle"
                                v-model="settings.webpConversion"
                                disabled
                                type="checkbox"
                            />
                            <label for="webp-toggle" />
                        </div>
                    </label>
                </div>
                <div class="setting-item">
                    <label>
                        <span class="setting-label">파일명 난독화</span>
                        <div class="toggle-switch">
                            <input
                                id="name-obfuscation-toggle"
                                v-model="settings.nameObfuscation"
                                type="checkbox"
                            />
                            <label for="name-obfuscation-toggle" />
                        </div>
                    </label>
                </div>
            </div>
        </section>

        <section class="group-section">
            <div class="section-header">
                <h2>이미지 그룹</h2>
                <div class="btn-group">
                    <button
                        class="btn btn-primary"
                        @click="addGroup"
                    >
                        <span class="icon">+</span> 추가
                    </button>
                    <button
                        :disabled="currentGroup === 0"
                        class="btn btn-secondary"
                        @click="editGroup"
                    >
                        <span class="icon">✏️</span> 수정
                    </button>
                    <button
                        :disabled="currentGroup === 0"
                        class="btn btn-danger"
                        @click="removeGroup"
                    >
                        <span class="icon">🗑️</span> 삭제
                    </button>
                </div>
            </div>

            <div class="group-selector">
                <select
                    v-model="currentGroup"
                    class="select-styled"
                >
                    <option
                        v-for="group in groupList"
                        :key="group.value"
                        :value="group.value"
                    >
                        {{ group.text }}
                    </option>
                </select>

                <div class="group-actions">
                    <div class="upload-container">
                        <label
                            class="file-upload-btn"
                            for="file-upload"
                        >
                            <span class="icon">📁</span> 업로드
                        </label>
                        <input
                            id="file-upload"
                            accept="image/*"
                            multiple
                            style="display: none"
                            type="file"
                            @change="imageUpload($event.target.files)"
                        />
                        <span
                            v-if="isUploading"
                            class="loading-spinner"
                        />
                    </div>

                    <div class="random-setting">
                        <label class="random-label">
                            <span>랜덤 설정</span>
                            <div class="toggle-switch">
                                <input
                                    :id="`random-toggle-${currentGroup}`"
                                    :checked="isRandomEnabledForCurrentGroup()"
                                    type="checkbox"
                                    @change="toggleRandomForCurrentGroup"
                                />
                                <label :for="`random-toggle-${currentGroup}`" />
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            <div
                v-if="imageList[currentGroup] && imageList[currentGroup].length > 0"
                class="image-controls"
            >
                <div class="select-all-container">
                    <label class="select-all-label">
                        <input
                            v-model="selectAllChecked"
                            type="checkbox"
                            @change="toggleSelectAll"
                        />
                        <span>전체 선택</span>
                    </label>
                </div>

                <button
                    :disabled="selectedImages.length === 0"
                    class="btn btn-danger"
                    @click="deleteSelectedImages"
                >
                    선택 삭제 ({{ selectedImages.length }})
                </button>
            </div>

            <div class="image-gallery">
                <div
                    v-if="!imageList[currentGroup] || imageList[currentGroup].length === 0"
                    class="empty-state"
                >
                    <p>이미지가 없습니다. 이미지를 업로드해 주세요.</p>
                </div>
                <div
                    v-else
                    class="image-grid"
                >
                    <div
                        v-for="(image, index) in imageList[currentGroup]"
                        :key="index"
                        :class="{ selected: selectedImages.includes(index) }"
                        class="image-card"
                    >
                        <div class="image-container">
                            <div class="image-number">
                                {{ index + 1 }}
                            </div>
                            <div class="image-checkbox">
                                <input
                                    :checked="selectedImages.includes(index)"
                                    type="checkbox"
                                    @change="toggleImageSelection(index)"
                                />
                            </div>
                            <img
                                :alt="image.filename"
                                :src="image.imageurl"
                                class="image-preview"
                            />
                            <div class="image-actions">
                                <button
                                    class="btn-icon"
                                    title="삭제"
                                    @click="removeImage(index)"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="image-name">
                            {{ image.filename }}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="gallery-section">
            <div class="section-header">
                <h2>갤러리 설정</h2>
                <div class="btn-group">
                    <button
                        class="btn btn-primary"
                        @click="startAddGallery"
                    >
                        <span class="icon">+</span> 추가
                    </button>
                </div>
            </div>

            <div
                v-if="isShowGalleryForm"
                class="gallery-form"
            >
                <div class="form-group">
                    <label
                        class="form-label"
                        for="gallery-id"
                        >갤러리 ID</label
                    >
                    <input
                        id="gallery-id"
                        v-model="newGalleryId"
                        class="form-input"
                        placeholder="예: programming"
                        type="text"
                    />
                </div>
                <div class="form-group group-selection">
                    <label class="form-label">사용할 그룹 선택</label>
                    <div class="checkbox-group">
                        <div
                            v-for="group in groupList"
                            :key="group.value"
                            class="checkbox-item"
                        >
                            <label>
                                <input
                                    :checked="selectedGroups.includes(group.value)"
                                    type="checkbox"
                                    @change="toggleGroupSelection(group.value)"
                                />
                                <span class="checkbox-label">{{ group.text }}</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="form-buttons">
                    <button
                        class="btn btn-primary"
                        @click="saveGallery"
                    >
                        {{ currentGallery ? "수정" : "추가" }}
                    </button>
                    <button
                        class="btn btn-secondary"
                        @click="cancelGalleryEdit"
                    >
                        취소
                    </button>
                </div>
            </div>

            <div class="gallery-list">
                <div
                    v-if="galleryList.length === 0"
                    class="empty-state"
                >
                    <p>등록된 갤러리가 없습니다. 새 갤러리를 추가해 주세요.</p>
                </div>
                <div
                    v-else
                    class="gallery-items"
                >
                    <div
                        v-for="gallery in galleryList"
                        :key="gallery.id"
                        class="gallery-item"
                    >
                        <div class="gallery-info">
                            <h3 class="gallery-id">
                                {{ gallery.id }}
                            </h3>
                            <div class="gallery-groups">
                                <span class="groups-label">사용 그룹:</span>
                                <div class="group-tags">
                                    <span
                                        v-for="groupValue in gallery.groups"
                                        :key="groupValue"
                                        class="group-tag"
                                    >
                                        {{ groupList.find((g) => g.value === groupValue)?.text || "삭제된 그룹" }}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="gallery-actions">
                            <button
                                class="btn btn-icon"
                                title="수정"
                                @click="startEditGallery(gallery)"
                            >
                                <span class="icon">✏️</span>
                            </button>
                            <button
                                class="btn btn-icon"
                                title="삭제"
                                @click="removeGallery(gallery)"
                            >
                                <span class="icon">🗑️</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <footer>
            <h5>Made by green1052</h5>
        </footer>
    </div>
</template>

<style lang="scss">
$bg-primary: #121212;
$bg-secondary: #1e1e1e;
$bg-tertiary: #2d2d2d;
$text-primary: #e0e0e0;
$text-secondary: #a0a0a0;
$accent-primary: #4dabf7;
$accent-secondary: #3498db;
$danger: #ff5e57;
$warning: #ffd43b;
$success: #20bf6b;
$border-color: #333333;
$shadow-color: rgba(0, 0, 0, 0.5);

$border-radius-sm: 6px;
$border-radius: 8px;
$border-radius-lg: 10px;

$transition-speed: 0.2s;

@mixin transition($property...) {
    transition: $property $transition-speed ease;
}

@mixin flex($direction: row, $justify: flex-start, $align: stretch, $gap: 0) {
    display: flex;
    flex-direction: $direction;
    justify-content: $justify;
    align-items: $align;
    @if $gap != 0 {
        gap: $gap;
    }
}

@mixin button-hover-effect($color, $alpha: 0.5) {
    &:hover {
        background-color: $color;
        box-shadow: 0 0 8px rgba($color, $alpha);
    }
}

@mixin card($padding: 20px, $radius: $border-radius) {
    background-color: $bg-secondary;
    border-radius: $radius;
    box-shadow: 0 4px 12px $shadow-color;
    padding: $padding;
    border: 1px solid $border-color;
}

:root {
    color-scheme: dark;
}

html,
body {
    background-color: $bg-primary;
    color: $text-primary;
    margin: 0;
    padding: 0;
    min-height: 100vh;
    font-family:
        "Pretendard Variable",
        -apple-system,
        BlinkMacSystemFont,
        system-ui,
        Roboto,
        sans-serif;
}

::-webkit-scrollbar {
    width: 10px;
    height: 10px;

    &-track {
        background: $bg-secondary;
    }

    &-thumb {
        background: #555;
        border-radius: 5px;

        &:hover {
            background: #666;
        }
    }
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    color: $text-primary;
    background-color: $bg-primary;
}

header {
    margin-bottom: 30px;
    border-bottom: 2px solid $accent-primary;
    padding-bottom: 10px;

    h1 {
        font-size: 28px;
        color: $accent-primary;
        margin: 0;
        font-weight: 700;
    }
}

footer {
    text-align: right;
}

h2 {
    font-size: 22px;
    color: $text-primary;
    margin: 0 0 15px 0;
    font-weight: 600;
}

.settings-section,
.group-section,
.gallery-section {
    @include card;
    margin-bottom: 30px;
}

.section-header {
    @include flex(row, space-between, center);
    margin-bottom: 20px;
}

.settings-card {
    background-color: $bg-tertiary;
    border-radius: $border-radius;
    padding: 15px;
    border: 1px solid $border-color;

    .setting-item {
        @include flex(row, flex-start, center);
        padding: 10px 0;
        border-bottom: 1px solid rgba($border-color, 0.5);

        &:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        &:first-child {
            padding-top: 0;
        }

        label {
            @include flex(row, space-between, center);
            width: 100%;
            cursor: pointer;
        }

        .setting-label {
            font-size: 16px;
            font-weight: 500;
            color: $text-primary;
        }
    }
}

.toggle-switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;

    input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    label {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #444;
        border-radius: 24px;
        cursor: pointer;
        transition: 0.4s;

        &:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 4px;
            bottom: 4px;
            background-color: $text-primary;
            border-radius: 50%;
            transition: 0.4s;
        }
    }

    input:checked + label {
        background-color: $accent-secondary;

        &:before {
            transform: translateX(26px);
        }
    }
}

.btn-group {
    @include flex(row, flex-start, center, 10px);
}

.btn {
    @include flex(row, flex-start, center);
    padding: 8px 16px;
    border: none;
    border-radius: $border-radius-sm;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    @include transition(all);
    color: $text-primary;

    .icon {
        margin-right: 5px;
    }

    &-primary {
        background-color: $accent-secondary;
        @include button-hover-effect($accent-primary);
    }

    &-secondary {
        background-color: #444;
        color: $warning;

        &:hover {
            background-color: #555;
            box-shadow: 0 0 8px rgba($warning, 0.3);
        }
    }

    &-danger {
        background-color: #444;
        color: $danger;

        &:hover {
            background-color: $danger;
            color: $text-primary;
            box-shadow: 0 0 8px rgba($danger, 0.5);
        }
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        box-shadow: none;
    }

    &-icon {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 18px;
        padding: 5px;
        color: $text-primary;
        opacity: 0.8;
        @include transition(opacity);

        &:hover {
            opacity: 1;
        }
    }
}

.group-selector {
    @include flex(row, flex-start, center, 15px);
    margin-bottom: 20px;
    flex-wrap: wrap;

    .select-styled {
        flex: 1;
        min-width: 200px;
        height: 40px;
        padding: 0 15px;
        background-color: $bg-tertiary;
        border: 1px solid $border-color;
        border-radius: $border-radius-sm;
        font-size: 16px;
        color: $text-primary;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23e0e0e0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        cursor: pointer;
        @include transition(border-color, box-shadow);

        &:focus {
            outline: none;
            border-color: $accent-primary;
            box-shadow: 0 0 0 2px rgba($accent-primary, 0.3);
        }
    }

    .group-actions {
        @include flex(row, flex-start, center, 15px);
        flex-wrap: wrap;
    }

    .random-setting {
        @include flex(row, flex-start, center);
        background-color: $bg-tertiary;
        padding: 6px 12px;
        border-radius: $border-radius-sm;
        border: 1px solid $border-color;

        .random-label {
            @include flex(row, flex-start, center, 10px);
            cursor: pointer;

            span {
                font-size: 14px;
                color: $text-primary;
                font-weight: 500;
            }
        }
    }
}

.image-controls {
    @include flex(row, space-between, center);
    margin-bottom: 15px;
    padding: 10px 15px;
    background-color: $bg-tertiary;
    border-radius: $border-radius;

    .select-all-container {
        .select-all-label {
            @include flex(row, flex-start, center);
            cursor: pointer;

            input[type="checkbox"] {
                margin-right: 8px;
            }

            span {
                font-size: 14px;
                font-weight: 500;
            }
        }
    }
}

.upload-container {
    @include flex(row, flex-start, center);

    .file-upload-btn {
        @include flex(row, flex-start, center);
        padding: 8px 16px;
        background-color: $accent-secondary;
        color: $text-primary;
        border-radius: $border-radius-sm;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        @include transition(background-color, box-shadow);
        @include button-hover-effect($accent-primary);

        .icon {
            margin-right: 5px;
        }
    }

    .loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        margin-left: 10px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: $accent-primary;
        border-radius: 50%;
        animation: spin 1s infinite linear;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
}

.image-gallery {
    margin-top: 20px;

    .empty-state {
        text-align: center;
        padding: 40px;
        background-color: $bg-tertiary;
        border-radius: $border-radius;
        color: $text-secondary;
        border: 1px dashed $border-color;
    }

    .image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 20px;
    }

    .image-card {
        background-color: $bg-tertiary;
        border-radius: $border-radius;
        overflow: hidden;
        box-shadow: 0 2px 8px $shadow-color;
        @include transition(transform, box-shadow, border-color);
        border: 1px solid $border-color;
        position: relative;

        &.selected {
            border-color: $accent-primary;
            box-shadow: 0 0 0 2px rgba($accent-primary, 0.6);

            .image-checkbox {
                opacity: 1;
            }
        }

        &:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px $shadow-color;
            border-color: $accent-secondary;

            .image-preview {
                transform: scale(1.05);
            }

            .image-actions,
            .image-checkbox,
            .image-number {
                opacity: 1;
            }
        }

        .image-container {
            position: relative;
            padding-top: 100%;
            overflow: hidden;
            background-color: #000;

            .image-preview {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                @include transition(transform);
            }

            .image-number {
                position: absolute;
                bottom: 0;
                left: 0;
                background-color: rgba(0, 0, 0, 0.7);
                color: $text-primary;
                padding: 4px 8px;
                font-size: 12px;
                border-top-right-radius: $border-radius-sm;
                opacity: 0.7;
                z-index: 2;
                @include transition(opacity);
            }

            .image-checkbox {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 2;
                opacity: 0.7;
                @include transition(opacity);

                input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }
            }

            .image-actions {
                position: absolute;
                top: 0;
                right: 0;
                padding: 5px;
                @include flex(row, flex-start, center, 5px);
                opacity: 0;
                @include transition(opacity);
                background: rgba(0, 0, 0, 0.7);
                border-bottom-left-radius: $border-radius;
                z-index: 2;
            }
        }

        .image-name {
            padding: 10px;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
            color: $text-primary;
        }
    }
}

.gallery-form {
    background-color: $bg-tertiary;
    border-radius: $border-radius;
    padding: 20px;
    margin-bottom: 20px;
    border: 1px solid $border-color;

    .form-group {
        margin-bottom: 15px;

        &:last-child {
            margin-bottom: 0;
        }
    }

    .form-label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: $text-primary;
    }

    .form-input {
        width: 100%;
        padding: 10px;
        background-color: $bg-primary;
        border: 1px solid $border-color;
        border-radius: $border-radius-sm;
        color: $text-primary;
        font-size: 16px;
        font-family: inherit;

        &:focus {
            outline: none;
            border-color: $accent-primary;
            box-shadow: 0 0 0 2px rgba($accent-primary, 0.3);
        }

        &::placeholder {
            color: $text-secondary;
        }
    }

    .group-selection {
        .checkbox-group {
            @include flex(column, flex-start, stretch, 10px);
            max-height: 200px;
            overflow-y: auto;
            padding: 10px;
            background-color: $bg-primary;
            border-radius: $border-radius-sm;
            border: 1px solid $border-color;
        }

        .checkbox-item {
            label {
                @include flex(row, flex-start, center);
                cursor: pointer;

                &.disabled {
                    opacity: 0.7;
                    cursor: default;
                }

                input[type="checkbox"] {
                    margin-right: 10px;
                    cursor: pointer;

                    &:disabled {
                        cursor: default;
                    }
                }

                .checkbox-label {
                    font-size: 14px;
                }
            }
        }
    }

    .form-buttons {
        @include flex(row, flex-end, center, 10px);
        margin-top: 20px;
    }
}

.gallery-list {
    margin-top: 20px;

    .empty-state {
        text-align: center;
        padding: 40px;
        background-color: $bg-tertiary;
        border-radius: $border-radius;
        color: $text-secondary;
        border: 1px dashed $border-color;
    }

    .gallery-items {
        @include flex(column, flex-start, stretch, 15px);
    }

    .gallery-item {
        @include flex(row, space-between, flex-start);
        background-color: $bg-tertiary;
        border-radius: $border-radius;
        padding: 15px;
        border: 1px solid $border-color;
        @include transition(transform, box-shadow, border-color);

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px $shadow-color;
            border-color: $accent-secondary;
        }

        .gallery-info {
            flex: 1;
        }

        .gallery-id {
            font-size: 18px;
            font-weight: 600;
            color: $accent-primary;
            margin: 0 0 10px;
        }

        .gallery-groups {
            @include flex(column, flex-start, stretch, 5px);

            .groups-label {
                font-size: 14px;
                color: $text-secondary;
            }

            .group-tags {
                @include flex(row, flex-start, center, 8px);
                flex-wrap: wrap;

                .group-tag {
                    padding: 4px 8px;
                    background-color: $bg-secondary;
                    border-radius: 15px;
                    font-size: 12px;
                    color: $text-primary;
                    border: 1px solid $border-color;
                }
            }
        }

        .gallery-actions {
            @include flex(row, flex-start, center, 5px);
        }
    }
}

@media (max-width: 768px) {
    .section-header {
        flex-direction: column;
        align-items: flex-start;

        .btn-group {
            margin-top: 10px;
            width: 100%;
        }
    }

    .group-selector {
        flex-direction: column;
        align-items: stretch;

        .select-styled {
            margin-bottom: 10px;
        }

        .group-actions {
            justify-content: space-between;
        }
    }

    .image-controls {
        flex-direction: column;
        gap: 10px;
        align-items: stretch;

        .select-all-container {
            width: 100%;
        }
    }

    .image-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }

    .gallery-item {
        flex-direction: column;

        .gallery-actions {
            margin-top: 15px;
            align-self: flex-end;
        }
    }
}

@media (max-width: 480px) {
    .image-grid {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    .btn-group {
        flex-wrap: wrap;

        .btn {
            flex: 1;
            min-width: 80px;
        }
    }
}
</style>
