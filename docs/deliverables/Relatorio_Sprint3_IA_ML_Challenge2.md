# Sprint 3: Inteligência Artificial e Machine Learning

## Problema

A FaroAI classifica clientes em quatro perfis de retenção para orientar a priorização de leads e as ações de concessionária. Esta execução usa uma base sintética gerada por services/ml/src/synthetic.py, com 10.000 registros e semente 42. O rótulo é criado pelo próprio gerador. Estas métricas avaliam a recuperação dos rótulos sintéticos e não representam desempenho em clientes Ford reais.

## Dados e preparação

- Base 1: 10,000 registros com sinais pós-compra, usada para segmentação exploratória.
- Base 2: 10,000 registros utilizáveis após limpeza, com 14 entradas de compra no classificador.
- Divisão estratificada: 8,000 treino e 2,000 teste.
- Duplicatas removidas: 0.
- Rótulos inválidos removidos: 0.
- Valores fora dos limites convertidos em ausentes: 0.
- Sinais de outlier pelo IQR, revisados e mantidos quando plausíveis: 301.
- Valores ausentes são imputados dentro do pipeline. Dados pós-compra não entram no classificador.

## Comparação de modelos

A seleção usa F1 macro médio em validação cruzada estratificada de três partes no treino. O conjunto de teste não escolhe o algoritmo.

| modelo | cv_f1_macro_media | cv_f1_macro_dp | cv_f1_ponderado_media | cv_acuracia_media |
| --- | --- | --- | --- | --- |
| XGBoost | 0.555 | 0.006 | 0.590 | 0.603 |
| Regressão logística | 0.527 | 0.015 | 0.563 | 0.562 |
| Random Forest | 0.519 | 0.009 | 0.559 | 0.576 |
| Baseline majoritária | 0.122 | 0.000 | 0.158 | 0.323 |

## Modelo final

A família escolhida foi **XGBoost**, ajustada por busca em grade no treino. Parâmetros: {"model__learning_rate": 0.05, "model__max_depth": 3, "model__n_estimators": 300}.

F1 macro no teste: **0.570**.

F1 ponderado no teste: **0.602**.

Acurácia no teste: **0.620**.

A menor revocação foi **0.281** para o perfil **esquecido**; essa classe merece atenção na revisão de erros.

| perfil | precision | recall | f1 | support |
| --- | --- | --- | --- | --- |
| abandono | 0.573 | 0.714 | 0.636 | 553.000 |
| economico | 0.474 | 0.462 | 0.468 | 377.000 |
| esquecido | 0.559 | 0.281 | 0.374 | 423.000 |
| fiel | 0.755 | 0.853 | 0.801 | 647.000 |

### Matriz de confusão

Cada linha é o perfil sintético; cada coluna é o perfil previsto.

| perfil_sintetico | abandono | economico | esquecido | fiel |
| --- | --- | --- | --- | --- |
| abandono | 395 | 85 | 35 | 38 |
| economico | 148 | 174 | 24 | 31 |
| esquecido | 111 | 83 | 119 | 110 |
| fiel | 35 | 25 | 35 | 552 |

## Uso e limites

O perfil previsto pode priorizar leads e selecionar ações já associadas aos perfis no FaroAI. O artefato classifier_sprint3_candidate.joblib segue o formato carregado pelo predictor Python, mas esta execução não substitui o arquivo usado pelo serviço. A avaliação foi feita com rótulos sintéticos e não aprova uso em produção.

Para avançar, treinar com dados Ford aprovados e desidentificados, corrigir os agregados de dealer/modelo para usar apenas registros anteriores, medir desempenho em uma separação temporal ou por concessionária e revisar erros por perfil antes de integrar o modelo à API.

## Computação

As células de análise e treino levaram 30.9 segundos nesta sessão. O XGBoost usou NVIDIA GeForce GTX 1660 Ti com device=cuda. K-Means, regressão logística e Random Forest rodam na CPU. Se não houver GPU ou suporte CUDA no XGBoost, o notebook usa CPU. O tempo varia conforme o processador e o runtime.
