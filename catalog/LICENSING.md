# License decision / Решение о лицензии

Status: **proposed, not adopted**.

No license was declared in the repository at the preparation baseline, commit `13c6f2834b13c202402c7c5421c08b597af406bf`. No license is asserted in the generated draft packages.

## Proposed choice

Use the [MIT License](https://opensource.org/license/mit) for the two distributable beforeword plugin packages, including the instruction and assets actually included in them.

In this proposal, recipients could use, copy, modify and redistribute those package contents, including commercially, while retaining the copyright and license notice. The license includes a warranty disclaimer. The full license text governs those terms.

This proposal does not license unrelated repository contents or the website as a whole. It must not be read as a grant already made.

## Почему требуется решение

В [требованиях каталога Claude](https://claude.com/docs/plugins/pre-submission-checklist) указано наличие файла LICENSE либо поля license. В текущем репозитории такого выбора нет.

Предложение: MIT для содержимого двух распространяемых пакетов beforeword, включая входящую в них инструкцию и значок. Оно разрешает использование, копирование, изменение и распространение, в том числе коммерческое, с сохранением уведомления об авторских правах и текста лицензии. Полные условия определяет текст MIT.

Это предложение ещё не принято и не распространяется на остальные материалы репозитория или весь сайт.

## Apply only after the owner's decision

After explicit approval, store the agreed complete license text as `catalog/approved-LICENSE.txt`, set `license.status` in `catalog/listing.json` to `approved`, and record the selected identifier. Rebuild and check both packages. Until then, no LICENSE file or license claim is inserted.

The release should retain the owner's decision in its change record; a placeholder value must never be presented as permission.
