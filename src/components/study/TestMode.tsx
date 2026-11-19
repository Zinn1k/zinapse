"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  ClipboardCheck,
  ArrowRight,
  Filter,
} from "lucide-react";
import confetti from "canvas-confetti";
import { type Card as DbCard, type Deck } from "@/lib/db";
import { checkAnswerWithFuzzy } from "@/lib/levenshtein";
import { MarkdownMath } from "../MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export type QuestionType = "multiple_choice" | "true_false" | "written" | "matching";

export interface BaseQuestion {
  id: string;
  cardId: string;
  type: QuestionType;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  prompt: string;
  imageData?: string;
  options: string[];
  correctAnswer: string;
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: "true_false";
  term: string;
  displayedDefinition: string;
  actualDefinition: string;
  isCorrectMatch: boolean;
}

export interface WrittenQuestion extends BaseQuestion {
  type: "written";
  prompt: string;
  imageData?: string;
  expectedTerm: string;
}

export interface MatchingQuestion extends BaseQuestion {
  type: "matching";
  pairs: {
    cardId: string;
    term: string;
    definition: string;
  }[];
  shuffledDefinitions: { id: string; text: string }[];
}

export type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | WrittenQuestion
  | MatchingQuestion;

export interface UserAnswer {
  questionId: string;
  answer: unknown;
  isCorrect?: boolean;
  score?: number;
}

export interface TestModeProps {
  deck: Deck;
  cards: DbCard[];
  userId?: string;
  onExit: () => void;
}

export function TestMode({ deck, cards: allCards, onExit }: TestModeProps) {
  // Setup options
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [questionCount, setQuestionCount] = useState<number | "all">(10);
  const [enabledTypes, setEnabledTypes] = useState<Record<QuestionType, boolean>>({
    multiple_choice: true,
    true_false: true,
    written: true,
    matching: true,
  });

  // Test session state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [filterOnlyMistakes, setFilterOnlyMistakes] = useState(false);

  useEffect(() => {
    if (allCards.length < 10) {
      setQuestionCount(allCards.length);
    }
  }, [allCards.length]);

  // Generate test questions based on target card list
  const generateQuestions = (targetCards: DbCard[]) => {
    const availableTypes = (
      Object.keys(enabledTypes) as QuestionType[]
    ).filter((t) => enabledTypes[t]);

    if (availableTypes.length === 0) {
      alert("Выберите хотя бы один тип вопросов!");
      return null;
    }

    const shuffled = [...targetCards].sort(() => 0.5 - Math.random());
    const count =
      questionCount === "all"
        ? shuffled.length
        : Math.min(questionCount, shuffled.length);
    const selectedCards = shuffled.slice(0, count);

    const generated: Question[] = [];

    // Helper to get random distractors
    const getDistractors = (excludeCardId: string, needed: number) => {
      const otherCards = allCards.filter((c) => c.id !== excludeCardId);
      return otherCards
        .sort(() => 0.5 - Math.random())
        .slice(0, needed)
        .map((c) => c.term || c.front || "");
    };

    let typeIndex = 0;

    for (let i = 0; i < selectedCards.length; i++) {
      const card = selectedCards[i];
      const term = card.term || card.front || "";
      const definition = card.definition || card.back || "";

      const qType = availableTypes[typeIndex % availableTypes.length];
      typeIndex++;

      if (qType === "multiple_choice") {
        const distractors = getDistractors(card.id, 3);
        const options = [...distractors, term].sort(() => 0.5 - Math.random());
        generated.push({
          id: `q_${i}_mc`,
          cardId: card.id,
          type: "multiple_choice",
          prompt: definition,
          imageData: card.imageData || card.frontImage,
          options,
          correctAnswer: term,
        });
      } else if (qType === "true_false") {
        const isMatch = Math.random() > 0.5;
        let displayedDef = definition;
        if (!isMatch && allCards.length > 1) {
          const other = allCards.find((c) => c.id !== card.id);
          if (other) displayedDef = other.definition || other.back || "";
        }
        generated.push({
          id: `q_${i}_tf`,
          cardId: card.id,
          type: "true_false",
          term,
          displayedDefinition: displayedDef,
          actualDefinition: definition,
          isCorrectMatch: displayedDef === definition,
        });
      } else if (qType === "written") {
        generated.push({
          id: `q_${i}_wr`,
          cardId: card.id,
          type: "written",
          prompt: definition,
          imageData: card.imageData || card.frontImage,
          expectedTerm: term,
        });
      } else if (qType === "matching") {
        const sliceEnd = Math.min(i + 3, selectedCards.length);
        const blockCards = selectedCards.slice(i, sliceEnd + 1);
        if (blockCards.length < 2) {
          const distractors = getDistractors(card.id, 3);
          const options = [...distractors, term].sort(() => 0.5 - Math.random());
          generated.push({
            id: `q_${i}_mc`,
            cardId: card.id,
            type: "multiple_choice",
            prompt: definition,
            imageData: card.imageData || card.frontImage,
            options,
            correctAnswer: term,
          });
        } else {
          const pairs = blockCards.map((c) => ({
            cardId: c.id,
            term: c.term || c.front || "",
            definition: c.definition || c.back || "",
          }));
          const shuffledDefinitions = blockCards
            .map((c) => ({ id: c.id, text: c.definition || c.back || "" }))
            .sort(() => 0.5 - Math.random());

          generated.push({
            id: `q_${i}_mat`,
            cardId: card.id,
            type: "matching",
            pairs,
            shuffledDefinitions,
          });
          i = sliceEnd;
        }
      }
    }

    return generated;
  };

  // Start test
  const handleStartTest = () => {
    if (allCards.length === 0) return;
    const generated = generateQuestions(allCards);
    if (!generated || generated.length === 0) return;

    setQuestions(generated);
    setUserAnswers({});
    setCurrentIdx(0);
    setIsConfiguring(false);
    setIsSubmitted(false);
  };

  // Repeat only mistakes
  const handleStartMistakesOnly = (mistakeCards: DbCard[]) => {
    if (mistakeCards.length === 0) return;
    const generated = generateQuestions(mistakeCards);
    if (!generated || generated.length === 0) return;

    setQuestions(generated);
    setUserAnswers({});
    setCurrentIdx(0);
    setIsConfiguring(false);
    setIsSubmitted(false);
  };

  // Record answer for question
  const handleAnswerChange = (questionId: string, answer: unknown) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        answer,
      },
    }));
  };

  // Grade the completed test
  const handleSubmitTest = () => {
    const gradedAnswers: Record<string, UserAnswer> = {};

    questions.forEach((q) => {
      const userAns = userAnswers[q.id]?.answer;

      if (q.type === "multiple_choice") {
        const isCorrect = userAns === q.correctAnswer;
        gradedAnswers[q.id] = {
          questionId: q.id,
          answer: userAns,
          isCorrect,
          score: isCorrect ? 1 : 0,
        };
      } else if (q.type === "true_false") {
        const isCorrect = userAns === q.isCorrectMatch;
        gradedAnswers[q.id] = {
          questionId: q.id,
          answer: userAns,
          isCorrect,
          score: isCorrect ? 1 : 0,
        };
      } else if (q.type === "written") {
        const typed = typeof userAns === "string" ? userAns : "";
        const check = checkAnswerWithFuzzy(typed, q.expectedTerm);
        const isCorrect = check.isExact || check.isClose;
        gradedAnswers[q.id] = {
          questionId: q.id,
          answer: typed,
          isCorrect,
          score: isCorrect ? 1 : 0,
        };
      } else if (q.type === "matching") {
        const matchMap = (userAns as Record<string, string>) || {};
        let matchedCount = 0;
        q.pairs.forEach((pair) => {
          if (matchMap[pair.cardId] === pair.cardId) {
            matchedCount++;
          }
        });
        const isCorrect = matchedCount === q.pairs.length;
        gradedAnswers[q.id] = {
          questionId: q.id,
          answer: matchMap,
          isCorrect,
          score: q.pairs.length > 0 ? matchedCount / q.pairs.length : 0,
        };
      }
    });

    setUserAnswers(gradedAnswers);
    setIsSubmitted(true);

    const totalScore = questions.reduce(
      (sum, q) => sum + (gradedAnswers[q.id]?.score || 0),
      0
    );
    const percentage = Math.round((totalScore / questions.length) * 100);

    if (percentage >= 70) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  if (allCards.length < 2) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-2" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
          Недостаточно карточек для теста
        </h2>
        <p className="text-zinc-500 text-sm max-w-sm">
          Для создания полноценного теста требуется хотя бы 2 карточки.
        </p>
        <Button onClick={onExit} variant="outline">
          Назад к колоде
        </Button>
      </div>
    );
  }

  // 1. CONFIGURATION SCREEN
  if (isConfiguring) {
    return (
      <div className="max-w-xl mx-auto px-4 py-4 space-y-6 animate-in fade-in duration-150">
        <header className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
            <div>
              <h1 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">
                Настройка теста
              </h1>
              <p className="text-xs text-zinc-500">{deck.title}</p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {/* Question Count Selection */}
          <UICard>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Количество вопросов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 20, "all" as const].map((num) => {
                  const maxAvail = allCards.length;
                  const isDisabled = num !== "all" && num > maxAvail;
                  const isSelected = questionCount === num;

                  return (
                    <Button
                      key={String(num)}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      disabled={isDisabled}
                      onClick={() => setQuestionCount(num)}
                      className={`flex flex-col h-auto py-2.5 ${
                        isSelected ? "bg-indigo-600 hover:bg-indigo-500 text-white" : ""
                      }`}
                    >
                      <span className="font-bold text-base">
                        {num === "all" ? "Все" : num}
                      </span>
                      <span className="text-[10px] opacity-70">
                        {num === "all" ? `${maxAvail} шт.` : "вопросов"}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </UICard>

          {/* Question Types Selection */}
          <UICard>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Типы вопросов
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Выбор варианта</div>
                  <div className="text-xs text-zinc-500">
                    1 верный ответ из 4 предложенных вариантов
                  </div>
                </div>
                <Switch
                  checked={enabledTypes.multiple_choice}
                  onCheckedChange={(v) =>
                    setEnabledTypes((prev) => ({ ...prev, multiple_choice: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Верно / Неверно</div>
                  <div className="text-xs text-zinc-500">
                    Определите, соответствует ли термин определению
                  </div>
                </div>
                <Switch
                  checked={enabledTypes.true_false}
                  onCheckedChange={(v) =>
                    setEnabledTypes((prev) => ({ ...prev, true_false: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Письменный ответ</div>
                  <div className="text-xs text-zinc-500">
                    Ввод термина вручную с допуском опечаток (Левенштейн)
                  </div>
                </div>
                <Switch
                  checked={enabledTypes.written}
                  onCheckedChange={(v) =>
                    setEnabledTypes((prev) => ({ ...prev, written: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Сопоставление</div>
                  <div className="text-xs text-zinc-500">
                    Соедините термины со списком определений
                  </div>
                </div>
                <Switch
                  checked={enabledTypes.matching}
                  onCheckedChange={(v) =>
                    setEnabledTypes((prev) => ({ ...prev, matching: v }))
                  }
                />
              </div>
            </CardContent>
          </UICard>

          <Button
            size="lg"
            className="w-full text-base font-semibold shadow bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={handleStartTest}
          >
            Начать тестирование
          </Button>
        </div>
      </div>
    );
  }

  // 2. RESULTS & REVIEW SCREEN
  if (isSubmitted) {
    const totalScore = questions.reduce(
      (sum, q) => sum + (userAnswers[q.id]?.score || 0),
      0
    );
    const percentage = Math.round((totalScore / questions.length) * 100);

    const questionsToDisplay = filterOnlyMistakes
      ? questions.filter((q) => !userAnswers[q.id]?.isCorrect)
      : questions;

    const gradeText =
      percentage >= 90
        ? "Отлично! Материал усвоен превосходно."
        : percentage >= 75
        ? "Хороший результат! Повторите несколько карточек."
        : percentage >= 50
        ? "Удовлетворительно. Рекомендуется повторить колоду."
        : "Требуется повторение. Попробуйте режим «Заучивание».";

    // Collect mistake cards
    const mistakeCards = allCards.filter((c) => {
      return questions.some((q) => {
        const ans = userAnswers[q.id];
        if (ans && !ans.isCorrect) {
          if (q.type === "matching") {
            return q.pairs.some((p) => p.cardId === c.id);
          }
          return q.cardId === c.id;
        }
        return false;
      });
    });

    return (
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6 pb-12 animate-in fade-in duration-150">
        <header className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
            <h1 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">
              Результаты теста
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfiguring(true)}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Пройти снова
          </Button>
        </header>

        <div className="space-y-6">
          {/* Summary Score Card */}
          <UICard className="text-center p-6 sm:p-8 bg-card border shadow-sm">
            <div className="text-5xl sm:text-6xl font-black font-mono text-indigo-600 dark:text-indigo-400 mb-2">
              {percentage}%
            </div>
            <div className="text-sm font-medium text-foreground mb-1">
              Набрано {totalScore.toFixed(1)} из {questions.length} баллов
            </div>
            <p className="text-xs sm:text-sm text-zinc-500">{gradeText}</p>
          </UICard>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {mistakeCards.length > 0 && (
              <Button
                variant="outline"
                className="flex-1 gap-2 border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => handleStartMistakesOnly(mistakeCards)}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Повторить только ошибки ({mistakeCards.length})</span>
              </Button>
            )}
            <Button
              className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
              onClick={() => setIsConfiguring(true)}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Новый тест</span>
            </Button>
            <Button variant="secondary" onClick={onExit}>
              Назад к колоде
            </Button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm font-bold flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Разбор вопросов ({questionsToDisplay.length})</span>
            </div>

            <Button
              variant={filterOnlyMistakes ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilterOnlyMistakes(!filterOnlyMistakes)}
              className="text-xs gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              {filterOnlyMistakes ? "Показать все" : "Только ошибки"}
            </Button>
          </div>

          {/* Detailed Question Review List */}
          <div className="space-y-4">
            {questionsToDisplay.map((q, idx) => {
              const ansRecord = userAnswers[q.id];
              const isCorrect = !!ansRecord?.isCorrect;

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border bg-card transition-all ${
                    isCorrect
                      ? "border-emerald-500/30 dark:border-emerald-500/20"
                      : "border-red-500/40 bg-red-50/20 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        isCorrect
                          ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                          : "border-red-500 text-red-600 bg-red-500/10"
                      }`}
                    >
                      {isCorrect ? (
                        <CheckCircle className="w-3 h-3 mr-1 inline" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1 inline" />
                      )}
                      Вопрос {idx + 1}
                    </Badge>
                  </div>

                  {/* Multiple Choice Review */}
                  {q.type === "multiple_choice" && (
                    <div className="space-y-2 text-sm">
                      <div className="text-xs text-zinc-500 font-semibold">
                        Определение:
                      </div>
                      <div className="font-medium p-2.5 rounded bg-zinc-100 dark:bg-zinc-800/60">
                        <MarkdownMath content={q.prompt} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                        <div>
                          <span className="text-xs text-zinc-500">Ваш ответ: </span>
                          <span
                            className={
                              isCorrect
                                ? "text-emerald-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            {(ansRecord?.answer as string) || "— Не отвечено"}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div>
                            <span className="text-xs text-zinc-500">Правильный ответ: </span>
                            <span className="text-emerald-600 font-semibold">
                              {q.correctAnswer}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* True / False Review */}
                  {q.type === "true_false" && (
                    <div className="space-y-2 text-sm">
                      <div className="p-2.5 rounded bg-zinc-100 dark:bg-zinc-800/60 space-y-1">
                        <div>
                          <span className="text-xs text-zinc-500">Термин: </span>
                          <span className="font-semibold">{q.term}</span>
                        </div>
                        <div>
                          <span className="text-xs text-zinc-500">Определение: </span>
                          <span>{q.displayedDefinition}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                        <div>
                          <span className="text-xs text-zinc-500">Ваш ответ: </span>
                          <span
                            className={
                              isCorrect
                                ? "text-emerald-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            {ansRecord?.answer === true
                              ? "Верно"
                              : ansRecord?.answer === false
                              ? "Неверно"
                              : "— Не отвечено"}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div>
                            <span className="text-xs text-zinc-500">Правильно: </span>
                            <span className="text-emerald-600 font-semibold">
                              {q.isCorrectMatch ? "Верно" : "Неверно"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Written Review */}
                  {q.type === "written" && (
                    <div className="space-y-2 text-sm">
                      <div className="text-xs text-zinc-500 font-semibold">
                        Определение:
                      </div>
                      <div className="font-medium p-2.5 rounded bg-zinc-100 dark:bg-zinc-800/60">
                        <MarkdownMath content={q.prompt} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                        <div>
                          <span className="text-xs text-zinc-500">Ваш ввод: </span>
                          <span
                            className={
                              isCorrect
                                ? "text-emerald-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            {(ansRecord?.answer as string) || "— Пусто"}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div>
                            <span className="text-xs text-zinc-500">Ожидалось: </span>
                            <span className="text-emerald-600 font-semibold">
                              {q.expectedTerm}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Matching Review */}
                  {q.type === "matching" && (
                    <div className="space-y-2 text-sm">
                      <div className="text-xs text-zinc-500 font-semibold">
                        Сопоставленные пары:
                      </div>
                      <div className="space-y-1.5">
                        {q.pairs.map((p) => {
                          const userMatchId = (
                            ansRecord?.answer as Record<string, string>
                          )?.[p.cardId];
                          const matchedDef = q.shuffledDefinitions.find(
                            (d) => d.id === userMatchId
                          );
                          const isPairCorrect = userMatchId === p.cardId;

                          return (
                            <div
                              key={p.cardId}
                              className={`p-2 rounded border text-xs flex flex-col sm:flex-row justify-between gap-1 ${
                                isPairCorrect
                                  ? "bg-emerald-500/5 border-emerald-500/30"
                                  : "bg-red-500/5 border-red-500/30"
                              }`}
                            >
                              <span className="font-semibold">{p.term}</span>
                              <span className="text-zinc-500">
                                ➔ {matchedDef ? matchedDef.text : "— Не сопоставлено"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 3. TEST TAKING SCREEN
  const currentQ = questions[currentIdx];
  const progressPercent =
    questions.length > 0
      ? Math.round((Object.keys(userAnswers).length / questions.length) * 100)
      : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col min-h-[600px] justify-between space-y-6">
      {/* Test Header */}
      <header className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm("Вы уверены, что хотите прервать прохождение теста?")) {
                setIsConfiguring(true);
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm sm:text-base leading-none text-zinc-900 dark:text-white">
              Вопрос {currentIdx + 1} из {questions.length}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">{deck.title}</p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => {
            const unanswered = questions.length - Object.keys(userAnswers).length;
            if (
              unanswered > 0 &&
              !confirm(
                `У вас осталось ${unanswered} неотвеченных вопросов. Завершить тест сейчас?`
              )
            ) {
              return;
            }
            handleSubmitTest();
          }}
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Завершить</span>
        </Button>
      </header>

      {/* Progress Bar */}
      <Progress value={progressPercent} className="h-1.5" />

      {/* Question Stepper Area */}
      <main className="flex-1 w-full flex flex-col justify-between">
        <div className="w-full">
          {/* Question Type Indicator */}
          <div className="mb-4 flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {currentQ.type === "multiple_choice" && "Выбор одного варианта"}
              {currentQ.type === "true_false" && "Верно или Неверно"}
              {currentQ.type === "written" && "Письменный ввод"}
              {currentQ.type === "matching" && "Сопоставление терминов"}
            </Badge>
            <span className="text-xs text-zinc-500">
              Отвечено: {Object.keys(userAnswers).length} / {questions.length}
            </span>
          </div>

          {/* QUESTION CARD */}
          <UICard className="p-5 sm:p-6 shadow-sm mb-6">
            {/* TYPE 1: MULTIPLE CHOICE */}
            {currentQ.type === "multiple_choice" && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Определение:
                </div>
                <div className="text-base sm:text-lg font-medium leading-relaxed text-zinc-900 dark:text-white">
                  <MarkdownMath content={currentQ.prompt} />
                </div>

                {currentQ.imageData && (
                  <div className="max-h-48 rounded-lg overflow-hidden border">
                    <img
                      src={currentQ.imageData}
                      alt="visual aid"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <div className="pt-2 grid grid-cols-1 gap-2.5">
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = userAnswers[currentQ.id]?.answer === opt;

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleAnswerChange(currentQ.id, opt)}
                        className={`w-full text-left p-3.5 rounded-xl border text-sm sm:text-base font-medium transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/30 font-semibold"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono font-bold text-zinc-400">
                            {optIdx + 1}
                          </span>
                          <MarkdownMath content={opt} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TYPE 2: TRUE / FALSE */}
            {currentQ.type === "true_false" && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-1">
                    <div className="text-xs uppercase font-semibold text-zinc-500">
                      Термин:
                    </div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      <MarkdownMath content={currentQ.term} />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <div className="text-xs uppercase font-semibold text-zinc-500">
                      Предложенное определение:
                    </div>
                    <div className="text-base text-zinc-900 dark:text-zinc-100 leading-relaxed">
                      <MarkdownMath content={currentQ.displayedDefinition} />
                    </div>
                  </div>
                </div>

                <div className="text-center text-xs text-zinc-500">
                  Соответствует ли данное определение указанному термину?
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    type="button"
                    variant={
                      userAnswers[currentQ.id]?.answer === true ? "default" : "outline"
                    }
                    size="lg"
                    onClick={() => handleAnswerChange(currentQ.id, true)}
                    className={`h-14 text-base font-bold gap-2 ${
                      userAnswers[currentQ.id]?.answer === true
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : ""
                    }`}
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span>Верно</span>
                  </Button>
                  <Button
                    type="button"
                    variant={
                      userAnswers[currentQ.id]?.answer === false ? "destructive" : "outline"
                    }
                    size="lg"
                    onClick={() => handleAnswerChange(currentQ.id, false)}
                    className="h-14 text-base font-bold gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Неверно</span>
                  </Button>
                </div>
              </div>
            )}

            {/* TYPE 3: WRITTEN */}
            {currentQ.type === "written" && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Определение:
                </div>
                <div className="text-base sm:text-lg font-medium leading-relaxed text-zinc-900 dark:text-white">
                  <MarkdownMath content={currentQ.prompt} />
                </div>

                {currentQ.imageData && (
                  <div className="max-h-48 rounded-lg overflow-hidden border">
                    <img
                      src={currentQ.imageData}
                      alt="visual aid"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <label className="text-xs text-zinc-500 font-medium">
                    Введите термин:
                  </label>
                  <Input
                    type="text"
                    placeholder="Ваш ответ..."
                    value={(userAnswers[currentQ.id]?.answer as string) || ""}
                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                    className="h-12 text-base font-medium"
                    autoFocus
                  />
                  <span className="text-[11px] text-zinc-400 block">
                    Допускаются небольшие опечатки (алгоритм Левенштейна).
                  </span>
                </div>
              </div>
            )}

            {/* TYPE 4: MATCHING BLOCK */}
            {currentQ.type === "matching" && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Сопоставьте каждый термин с его определением:
                </div>

                <div className="space-y-3 pt-1">
                  {currentQ.pairs.map((pair, pIdx) => {
                    const currentSelectedDef = (
                      userAnswers[currentQ.id]?.answer as Record<string, string>
                    )?.[pair.cardId];

                    return (
                      <div
                        key={pair.cardId}
                        className="p-3 border rounded-xl bg-card space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
                            {pIdx + 1}
                          </span>
                          <span className="font-semibold text-sm">{pair.term}</span>
                        </div>

                        <select
                          className="w-full h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={currentSelectedDef || ""}
                          onChange={(e) => {
                            const prev =
                              (userAnswers[currentQ.id]?.answer as Record<
                                string,
                                string
                              >) || {};
                            handleAnswerChange(currentQ.id, {
                              ...prev,
                              [pair.cardId]: e.target.value,
                            });
                          }}
                        >
                          <option value="">-- Выберите определение --</option>
                          {currentQ.shuffledDefinitions.map((def) => (
                            <option key={def.id} value={def.id}>
                              {def.text}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </UICard>

          {/* Quick Question Jump Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 py-2">
            {questions.map((q, idx) => {
              const isAnswered = !!userAnswers[q.id];
              const isCurrent = currentIdx === idx;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-7 h-7 rounded text-xs font-mono font-bold transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white ring-2 ring-indigo-500/40"
                      : isAnswered
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-indigo-500/40"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stepper Navigation Prev / Next */}
        <div className="flex items-center justify-between gap-3 pt-6">
          <Button
            variant="outline"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          >
            Назад
          </Button>

          {currentIdx < questions.length - 1 ? (
            <Button
              onClick={() =>
                setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
              }
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <span>Следующий</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmitTest}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-semibold"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Завершить тест</span>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
