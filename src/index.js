import {initAndRender} from './app';
import {Chapter1_SimplifiedHash} from './chapter1_simplified_hash.js';
import {Chapter2_HashTableFunctions} from './chapter2_hash_table_functions.js';
import {Chapter3_HashClass} from './chapter3_hash_class.js';
import {Chapter4_RealPythonDict} from './chapter4_real_python_dict.js';

export const CHAPTER_ID_TO_COMPONENT = {
    chapter1: Chapter1_SimplifiedHash,
    chapter2: Chapter2_HashTableFunctions,
    chapter3: Chapter3_HashClass,
    chapter4: Chapter4_RealPythonDict,
};

if (typeof window !== 'undefined') {
    const chapters = window.insidePythonDictChapters.map(chapterId => CHAPTER_ID_TO_COMPONENT[chapterId]);
    initAndRender(chapters);
}
