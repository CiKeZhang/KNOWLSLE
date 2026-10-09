<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true" :model="filter">
        <el-form-item label="类型">
          <el-select v-model="filter.type" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="t in RESOURCE_TYPE_LIST" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="阶段">
          <el-select v-model="filter.stage" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="s in STAGE_LIST" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="filter.keyword" clearable placeholder="标题/描述" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load"><el-icon><Search /></el-icon> 查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16">
      <el-col v-for="r in list" :key="r.id" :xs="24" :sm="12" :md="8" :lg="6">
        <el-card class="resource-card" shadow="hover" @click="view(r)">
          <div class="r-head">
            <el-tag size="small">{{ resourceTypeLabel(r.type) }}</el-tag>
            <span class="views"><el-icon><View /></el-icon>{{ r.viewCount }}</span>
          </div>
          <h3 class="r-title">{{ r.title }}</h3>
          <p class="r-desc">{{ r.description || '暂无描述' }}</p>
          <div class="r-meta">
            <span v-if="r.stage" class="muted">{{ stageLabel(r.stage) }}</span>
            <span v-if="r.majorName" class="muted">{{ r.majorName }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-empty v-if="list.length === 0" description="暂无资源,可联系导师上传" />
    <el-pagination
      v-if="total > pageSize"
      class="mt-16"
      v-model:current-page="filter.page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next"
      @current-change="load"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ResourcesApi } from '@/api';
import {
  RESOURCE_TYPE_LIST, resourceTypeLabel,
  STAGE_LIST, stageLabel,
} from '@/utils/stage';

const filter = reactive({ type: '', stage: '', keyword: '', page: 1 });
const list = ref<any[]>([]);
const total = ref(0);
const pageSize = 20;

async function load() {
  try {
    const res: any = await ResourcesApi.list(filter);
    list.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    /* 已提示 */
  }
}

async function view(r: any) {
  if (r.url) {
    window.open(r.url, '_blank');
  }
  await ResourcesApi.view(r.id);
}

onMounted(load);
</script>

<style scoped>
.resource-card { margin-bottom: 16px; cursor: pointer; }
.r-head { display: flex; justify-content: space-between; align-items: center; }
.views { color: #909399; font-size: 12px; display: flex; align-items: center; gap: 2px; }
.r-title { font-size: 15px; margin: 8px 0; line-height: 1.4; }
.r-desc { color: #606266; font-size: 13px; margin: 8px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.r-meta { display: flex; gap: 12px; }
.muted { color: #909399; font-size: 12px; }
.mt-16 { margin-top: 16px; }
</style>
