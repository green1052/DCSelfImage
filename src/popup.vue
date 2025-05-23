<script lang="ts" setup>
import browser from "webextension-polyfill";

browser.runtime.openOptionsPage();
window.close();
</script>
