import type { PresentArray } from '@glimmer/interfaces';
import { ASTv2, KEYWORDS_TYPES } from '@glimmer/syntax';
import { getLast, isPresentArray } from '@glimmer/util';

import type { AnyOptionalList, PresentList } from '../../../shared/list';
import { Ok, Result, ResultArray } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import type { NormalizationState } from '../context';
import { CALL_KEYWORDS } from '../keywords';
import { hasPath } from '../utils/is-node';

export class NormalizeExpressions {
  visit(node: ASTv2.ExpressionNode, state: NormalizationState): Result<mir.ExpressionNode> {
    switch (node.type) {
      case 'Literal':
        return Ok(this.Literal(node));
      case 'Interpolate':
        return this.Interpolate(node, state);
      case 'Path':
        return this.PathExpression(node);
      case 'Call': {
        let translated = CALL_KEYWORDS.translate(node, state);

        if (translated !== null) {
          return translated;
        }

        return this.CallExpression(node, state);
      }
      case 'DeprecatedCall':
        return this.DeprecaedCallExpression(node, state);
    }
  }

  visitList(
    nodes: PresentArray<ASTv2.ExpressionNode>,
    state: NormalizationState
  ): Result<PresentList<mir.ExpressionNode>>;
  visitList(
    nodes: readonly ASTv2.ExpressionNode[],
    state: NormalizationState
  ): Result<AnyOptionalList<mir.ExpressionNode>>;
  visitList(
    nodes: readonly ASTv2.ExpressionNode[],
    state: NormalizationState
  ): Result<AnyOptionalList<mir.ExpressionNode>> {
    return new ResultArray(nodes.map((e) => VISIT_EXPRS.visit(e, state))).toOptionalList();
  }

  /**
   * Normalize paths into `hir.Path` or a `hir.Expr` that corresponds to the ref.
   *
   * TODO since keywords don't support tails anyway, distinguish PathExpression from
   * VariableReference in ASTv2.
   */
  PathExpression(path: ASTv2.PathExpression): Result<mir.ExpressionNode> {
    let ref = this.VariableReference(path.ref);
    let { tail } = path;

    if (isPresentArray(tail)) {
      let tailLoc = tail[0].loc.extend(getLast(tail).loc);
      return Ok(
        new mir.PathExpression({
          loc: path.loc,
          head: ref,
          tail: new mir.Tail({ loc: tailLoc, members: tail }),
        })
      );
    } else {
      return Ok(ref);
    }
  }

  VariableReference(ref: ASTv2.VariableReference): ASTv2.VariableReference {
    return ref;
  }

  Literal(literal: ASTv2.LiteralExpression): ASTv2.LiteralExpression {
    return literal;
  }

  Interpolate(
    expr: ASTv2.InterpolateExpression,
    state: NormalizationState
  ): Result<mir.InterpolateExpression> {
    let parts = expr.parts.map(convertPathToCallIfKeyword) as PresentArray<ASTv2.ExpressionNode>;

    return VISIT_EXPRS.visitList(parts, state).mapOk(
      (parts) => new mir.InterpolateExpression({ loc: expr.loc, parts: parts })
    );
  }

  CallExpression(
    expr: ASTv2.CallExpression,
    state: NormalizationState
  ): Result<mir.ExpressionNode> {
    if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      return Result.all(
        VISIT_EXPRS.visit(expr.callee, state),
        VISIT_EXPRS.Args(expr.args, state)
      ).mapOk(
        ([callee, args]) =>
          new mir.CallExpression({
            loc: expr.loc,
            callee,
            args,
          })
      );
    }
  }

  DeprecaedCallExpression(
    { arg, callee, loc }: ASTv2.DeprecatedCallExpression,
    _state: NormalizationState
  ): Result<mir.ExpressionNode> {
    return Ok(new mir.DeprecatedCallExpression({ loc, arg, callee }));
  }

  Args({ positional, named, loc }: ASTv2.Args, state: NormalizationState): Result<mir.Args> {
    return Result.all(this.Positional(positional, state), this.NamedArguments(named, state)).mapOk(
      ([positional, named]) =>
        new mir.Args({
          loc,
          positional,
          named,
        })
    );
  }

  Positional(
    positional: ASTv2.PositionalArguments,
    state: NormalizationState
  ): Result<mir.Positional> {
    return VISIT_EXPRS.visitList(positional.exprs, state).mapOk(
      (list) =>
        new mir.Positional({
          loc: positional.loc,
          list,
        })
    );
  }

  NamedArguments(
    named: ASTv2.NamedArguments,
    state: NormalizationState
  ): Result<mir.NamedArguments> {
    let pairs = named.entries.map((arg) => {
      let value = convertPathToCallIfKeyword(arg.value);

      return VISIT_EXPRS.visit(value, state).mapOk(
        (value) =>
          new mir.NamedArgument({
            loc: arg.loc,
            key: arg.name,
            value,
          })
      );
    });

    return new ResultArray(pairs)
      .toOptionalList()
      .mapOk((pairs) => new mir.NamedArguments({ loc: named.loc, entries: pairs }));
  }
}

export function convertPathToCallIfKeyword(path: ASTv2.ExpressionNode): ASTv2.ExpressionNode {
  if (path.type === 'Path' && path.ref.type === 'Free' && path.ref.name in KEYWORDS_TYPES) {
    return new ASTv2.CallExpression({
      callee: path,
      args: ASTv2.Args.empty(path.loc),
      loc: path.loc,
    });
  }

  return path;
}

export const VISIT_EXPRS = new NormalizeExpressions();
